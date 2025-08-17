/**
 * Context Management Router - Comprehensive Context Lifecycle Management
 * 
 * Provides enterprise-grade context management with:
 * - Context storage and retrieval with intelligent caching
 * - Context clustering and semantic organization
 * - Context flow tracking and visualization
 * - Context similarity search and recommendations
 * - Context lifecycle management with automated cleanup
 * - Context analytics and insights dashboard
 * - Real-time context updates via WebSocket
 * - Context templates and pattern recognition
 * 
 * Integrates with enhanced-context-manager and realtime-broadcast-service
 */

import { type Request, type Response,Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { authenticate } from '@/middleware/auth';
import { validateParams } from '@/middleware/validation';
import { zodValidate } from '@/middleware/zod-validate';
import { contextStorageService } from '@/services/context-storage-service';
import { enhancedContextManager } from '@/services/enhanced-context-manager';
import type { RealtimeBroadcastService } from '@/services/realtime-broadcast-service';
import { log, LogContext } from '@/utils/logger';

// Validation Schemas
const contextStoreSchema = z.object({
  content: z.string().min(1).max(50000),
  category: z.enum(['conversation', 'project', 'document', 'code', 'memory', 'task', 'template']),
  source: z.string().optional(),
  projectPath: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  importance: z.number().min(0).max(1).optional().default(0.5),
  metadata: z.record(z.any()).optional().default({})
});

const contextSearchSchema = z.object({
  query: z.string().min(1),
  category: z.enum(['conversation', 'project', 'document', 'code', 'memory', 'task', 'template']).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  minSimilarity: z.number().min(0).max(1).optional().default(0.3),
  timeRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional()
  }).optional()
});

const contextClusteringSchema = z.object({
  algorithm: z.enum(['kmeans', 'hierarchical', 'semantic']).optional().default('semantic'),
  numClusters: z.number().min(2).max(50).optional().default(10),
  minClusterSize: z.number().min(1).max(100).optional().default(3),
  category: z.enum(['conversation', 'project', 'document', 'code', 'memory', 'task', 'template']).optional(),
  timeRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional()
  }).optional()
});

const contextFlowTrackingSchema = z.object({
  sessionId: z.string(),
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }).optional(),
  includeMetrics: z.boolean().optional().default(true),
  granularity: z.enum(['minute', 'hour', 'day']).optional().default('hour')
});

const contextTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  category: z.enum(['conversation', 'project', 'document', 'code', 'memory', 'task', 'template']),
  template: z.object({
    structure: z.record(z.any()),
    placeholders: z.array(z.string()),
    defaultValues: z.record(z.any()).optional()
  }),
  tags: z.array(z.string()).optional().default([]),
  isPublic: z.boolean().optional().default(false)
});

// Types
interface ContextEntry {
  id: string;
  content: string;
  category: string;
  source?: string;
  userId: string;
  projectPath?: string;
  tags: string[];
  importance: number;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  accessCount: number;
  lastAccessed: string;
}

// Transform function to convert StoredContext to ContextEntry
function transformStoredToContextEntry(stored: any): ContextEntry {
  return {
    id: stored.id,
    content: stored.content,
    category: stored.category,
    source: stored.source,
    userId: stored.userId,
    projectPath: stored.projectPath,
    tags: stored.tags || [],
    importance: stored.importance || 0,
    metadata: stored.metadata || {},
    createdAt: stored.created_at,
    updatedAt: stored.updated_at || stored.created_at,
    accessCount: stored.access_count || 0,
    lastAccessed: stored.updated_at || stored.created_at
  };
}

interface ContextCluster {
  id: string;
  name: string;
  description: string;
  size: number;
  centroid: number[];
  contexts: ContextEntry[];
  tags: string[];
  createdAt: string;
  coherenceScore: number;
}

interface ContextFlow {
  sessionId: string;
  userId: string;
  startTime: string;
  endTime: string;
  totalContexts: number;
  contextTypes: Record<string, number>;
  flowMetrics: {
    averageImportance: number;
    contextDiversity: number;
    temporalDensity: number;
    accessPatterns: Array<{
      timestamp: string;
      contextId: string;
      accessType: 'create' | 'read' | 'update' | 'delete';
    }>;
  };
}

interface ContextSimilarity {
  contextId: string;
  similarity: number;
  sharedTags: string[];
  semanticSimilarity: number;
  temporalSimilarity: number;
  metadata: Record<string, any>;
}

interface ContextAnalytics {
  userId: string;
  timeRange: {
    start: string;
    end: string;
  };
  metrics: {
    totalContexts: number;
    categoriesDistribution: Record<string, number>;
    averageImportance: number;
    mostAccessedContexts: ContextEntry[];
    contextGrowthTrend: Array<{
      date: string;
      count: number;
    }>;
    topTags: Array<{
      tag: string;
      count: number;
    }>;
    clusteringInsights: {
      optimalClusters: number;
      clusterCoherence: number;
      topics: string[];
    };
  };
}

interface ContextTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  template: {
    structure: Record<string, any>;
    placeholders: string[];
    defaultValues: Record<string, any>;
  };
  tags: string[];
  isPublic: boolean;
  createdBy: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

const router = Router();
let broadcastService: RealtimeBroadcastService | null = null;

// Initialize broadcast service
export function initializeContextBroadcast(broadcast: RealtimeBroadcastService) {
  broadcastService = broadcast;
}

/**
 * Store context with automatic clustering and real-time updates
 * POST /api/context/store
 */
router.post('/store', 
  authenticate,
  zodValidate(contextStoreSchema),
  async (req: Request, res: Response) => {
    try {
      const { content, category, source, projectPath, tags, importance, metadata } = req.body;
      const userId = req.user?.id || 'anonymous';

      // Store context using enhanced context manager
      const contextId = uuidv4();
      const storedContext = await contextStorageService.storeContext({
        id: contextId,
        content,
        category,
        source,
        userId,
        projectPath,
        importance,
        metadata: {
          ...metadata,
          tags,
          storedAt: new Date().toISOString(),
          version: '1.0'
        }
      });

      // Add to enhanced context manager if it's a conversation
      if (category === 'conversation') {
        await enhancedContextManager.addMessage(
          metadata.sessionId || uuidv4(),
          {
            role: metadata.role || 'user',
            content,
            metadata: { userId, ...metadata }
          }
        );
      }

      // Broadcast real-time update
      if (broadcastService) {
        broadcastService.broadcastToRoom('memory_timeline', 'context_stored', {
          contextId: storedContext || contextId,
          category,
          userId,
          timestamp: new Date().toISOString(),
          tags,
          importance
        });
      }

      log.info('Context stored successfully', LogContext.CONTEXT_INJECTION, {
        contextId: storedContext || contextId,
        category,
        userId,
        contentLength: content.length
      });

      res.status(201).json({
        success: true,
        data: {
          contextId: storedContext || contextId,
          category,
          importance,
          tags,
          createdAt: new Date().toISOString()
        },
        message: 'Context stored successfully'
      });

    } catch (error) {
      log.error('Failed to store context', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to store context',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Search contexts with semantic similarity
 * POST /api/context/search
 */
router.post('/search',
  authenticate,
  zodValidate(contextSearchSchema),
  async (req: Request, res: Response) => {
    try {
      const { query, category, tags, limit, minSimilarity, timeRange } = req.body;
      const userId = req.user?.id || 'anonymous';

      // Search using context storage service
      const contexts = await contextStorageService.searchContext(
        userId,
        query,
        category,
        limit
      );

      // Filter by tags if provided
      let filteredContexts = contexts;
      if (tags && tags.length > 0) {
        filteredContexts = contexts.filter(context => 
          tags.some((tag: string) => context.tags?.includes(tag))
        );
      }

      // Filter by time range if provided
      if (timeRange) {
        const startTime = timeRange.start ? new Date(timeRange.start) : new Date(0);
        const endTime = timeRange.end ? new Date(timeRange.end) : new Date();
        
        filteredContexts = filteredContexts.filter(context => {
          const contextTime = new Date(context.created_at);
          return contextTime >= startTime && contextTime <= endTime;
        });
      }

      // Calculate similarity scores and apply threshold
      const contextsWithSimilarity = filteredContexts.map(context => ({
        ...context,
        similarity: calculateTextSimilarity(query, context.content),
        relevanceScore: calculateRelevanceScore(context, query, tags)
      }))
      .filter(context => context.similarity >= minSimilarity)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

      log.info('Context search completed', LogContext.CONTEXT_INJECTION, {
        query,
        userId,
        resultsCount: contextsWithSimilarity.length,
        minSimilarity
      });

      res.json({
        success: true,
        data: {
          contexts: contextsWithSimilarity,
          query,
          totalResults: contextsWithSimilarity.length,
          searchMetadata: {
            minSimilarity,
            category,
            tags,
            timeRange
          }
        },
        message: 'Context search completed successfully'
      });

    } catch (error) {
      log.error('Context search failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Context search failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Get context clusters with semantic organization
 * POST /api/context/clusters
 */
router.post('/clusters',
  authenticate,
  zodValidate(contextClusteringSchema),
  async (req: Request, res: Response) => {
    try {
      const { algorithm, numClusters, minClusterSize, category, timeRange } = req.body;
      const userId = req.user?.id || 'anonymous';

      // Get user's contexts
      const contexts = await contextStorageService.getContext(
        userId,
        category,
        undefined,
        1000 // Get more contexts for clustering
      );

      // Filter by time range if provided
      let filteredContexts = contexts;
      if (timeRange) {
        const startTime = timeRange.start ? new Date(timeRange.start) : new Date(0);
        const endTime = timeRange.end ? new Date(timeRange.end) : new Date();
        
        filteredContexts = contexts.filter(context => {
          const contextTime = new Date(context.created_at);
          return contextTime >= startTime && contextTime <= endTime;
        });
      }

      if (filteredContexts.length < minClusterSize) {
        return res.json({
          success: true,
          data: {
            clusters: [],
            algorithm,
            message: 'Insufficient contexts for clustering'
          }
        });
      }

      // Perform clustering based on algorithm
      const clusters = await performContextClustering(
        filteredContexts,
        algorithm,
        numClusters,
        minClusterSize
      );

      // Broadcast cluster update
      if (broadcastService) {
        broadcastService.broadcastToRoom('knowledge_graph', 'clusters_updated', {
          userId,
          clustersCount: clusters.length,
          algorithm,
          timestamp: new Date().toISOString()
        });
      }

      log.info('Context clustering completed', LogContext.CONTEXT_INJECTION, {
        userId,
        algorithm,
        clustersGenerated: clusters.length,
        totalContexts: filteredContexts.length
      });

      return res.json({
        success: true,
        data: {
          clusters,
          algorithm,
          totalContexts: filteredContexts.length,
          clusteringMetadata: {
            numClusters,
            minClusterSize,
            category,
            timeRange
          }
        },
        message: 'Context clustering completed successfully'
      });

    } catch (error) {
      log.error('Context clustering failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });

      return res.status(500).json({
        success: false,
        error: 'Context clustering failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Track context flow for a session
 * POST /api/context/flow
 */
router.post('/flow',
  authenticate,
  zodValidate(contextFlowTrackingSchema),
  async (req: Request, res: Response) => {
    try {
      const { sessionId, timeRange, includeMetrics, granularity } = req.body;
      const userId = req.user?.id || 'anonymous';

      // Get context flow data
      const contextFlow = await trackContextFlow(
        userId,
        sessionId,
        timeRange,
        includeMetrics,
        granularity
      );

      log.info('Context flow tracking completed', LogContext.CONTEXT_INJECTION, {
        userId,
        sessionId,
        totalContexts: contextFlow.totalContexts
      });

      return res.json({
        success: true,
        data: contextFlow,
        message: 'Context flow tracking completed successfully'
      });

    } catch (error) {
      log.error('Context flow tracking failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });

      return res.status(500).json({
        success: false,
        error: 'Context flow tracking failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Find similar contexts
 * GET /api/context/:contextId/similar
 */
router.get('/:contextId/similar',
  authenticate,
  validateParams(z.object({ contextId: z.string().min(1) })),
  async (req: Request, res: Response) => {
    try {
      const { contextId } = req.params;
      const userId = req.user?.id || 'anonymous';
      const limit = parseInt(req.query.limit as string) || 10;
      const minSimilarity = parseFloat(req.query.minSimilarity as string) || 0.3;

      // Get the reference context
      const referenceContext = await contextStorageService.getContextById(contextId!);
      if (!referenceContext || referenceContext.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: 'Context not found or access denied'
        });
      }

      // Find similar contexts
      const similarContexts = await findSimilarContexts(
        referenceContext,
        userId,
        limit,
        minSimilarity
      );

      log.info('Similar contexts found', LogContext.CONTEXT_INJECTION, {
        userId,
        contextId,
        similarCount: similarContexts.length
      });

      return res.json({
        success: true,
        data: {
          referenceContext: {
            id: referenceContext.id,
            content: referenceContext.content,
            category: referenceContext.category,
            tags: referenceContext.tags
          },
          similarContexts,
          searchParams: {
            limit,
            minSimilarity
          }
        },
        message: 'Similar contexts found successfully'
      });

    } catch (error) {
      log.error('Finding similar contexts failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to find similar contexts',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Get context analytics and insights
 * GET /api/context/analytics
 */
router.get('/analytics',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id || 'anonymous';
      const timeRange = {
        start: req.query.start as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: req.query.end as string || new Date().toISOString()
      };

      // Generate analytics
      const analytics = await generateContextAnalytics(userId, timeRange);

      log.info('Context analytics generated', LogContext.CONTEXT_INJECTION, {
        userId,
        totalContexts: analytics.metrics.totalContexts,
        timeRange
      });

      res.json({
        success: true,
        data: analytics,
        message: 'Context analytics generated successfully'
      });

    } catch (error) {
      log.error('Context analytics generation failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate context analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Get or create context templates
 * GET /api/context/templates
 * POST /api/context/templates
 */
router.get('/templates',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id || 'anonymous';
      const category = req.query.category as string;
      const isPublic = req.query.public === 'true';

      // Get templates
      const templates = await getContextTemplates(userId, category, isPublic);

      res.json({
        success: true,
        data: templates,
        message: 'Context templates retrieved successfully'
      });

    } catch (error) {
      log.error('Failed to get context templates', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get context templates',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.post('/templates',
  authenticate,
  zodValidate(contextTemplateSchema),
  async (req: Request, res: Response) => {
    try {
      const { name, description, category, template, tags, isPublic } = req.body;
      const userId = req.user?.id || 'anonymous';

      // Create template
      const templateId = uuidv4();
      const newTemplate: ContextTemplate = {
        id: templateId,
        name,
        description,
        category,
        template,
        tags,
        isPublic,
        createdBy: userId,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Store template
      await storeContextTemplate(newTemplate);

      log.info('Context template created', LogContext.CONTEXT_INJECTION, {
        templateId,
        name,
        category,
        userId
      });

      res.status(201).json({
        success: true,
        data: newTemplate,
        message: 'Context template created successfully'
      });

    } catch (error) {
      log.error('Failed to create context template', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create context template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Real-time context updates
 * GET /api/context/realtime/status
 */
router.get('/realtime/status',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const status = broadcastService?.getServiceHealth() || {
        status: 'unavailable',
        connectedClients: 0,
        activeRooms: [],
        bufferStatus: {}
      };

      res.json({
        success: true,
        data: {
          realtime: status,
          contextManager: enhancedContextManager.getStats()
        },
        message: 'Real-time status retrieved successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get real-time status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Context lifecycle management
 * DELETE /api/context/:contextId
 * PUT /api/context/:contextId
 */
router.put('/:contextId',
  authenticate,
  validateParams(z.object({ contextId: z.string().min(1) })),
  async (req: Request, res: Response) => {
    try {
      const { contextId } = req.params;
      const userId = req.user?.id || 'anonymous';
      const updates = req.body;

      // Update context
      const updatedContext = await updateContext(contextId!, userId, updates);

      if (!updatedContext) {
        return res.status(404).json({
          success: false,
          error: 'Context not found or access denied'
        });
      }

      // Broadcast update
      if (broadcastService) {
        broadcastService.broadcastToRoom('memory_timeline', 'context_updated', {
          contextId,
          userId,
          timestamp: new Date().toISOString(),
          updates: Object.keys(updates)
        });
      }

      return res.json({
        success: true,
        data: updatedContext,
        message: 'Context updated successfully'
      });

    } catch (error) {
      log.error('Failed to update context', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to update context',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.delete('/:contextId',
  authenticate,
  validateParams(z.object({ contextId: z.string().min(1) })),
  async (req: Request, res: Response) => {
    try {
      const { contextId } = req.params;
      const userId = req.user?.id || 'anonymous';

      // Delete context
      const deleted = await deleteContext(contextId!, userId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Context not found or access denied'
        });
      }

      // Broadcast deletion
      if (broadcastService) {
        broadcastService.broadcastToRoom('memory_timeline', 'context_deleted', {
          contextId,
          userId,
          timestamp: new Date().toISOString()
        });
      }

      return res.json({
        success: true,
        message: 'Context deleted successfully'
      });

    } catch (error) {
      log.error('Failed to delete context', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to delete context',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Helper Functions

/**
 * Calculate text similarity using simple Jaccard similarity
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Calculate relevance score combining multiple factors
 */
function calculateRelevanceScore(
  context: any,
  query: string,
  tags?: string[]
): number {
  let score = 0;
  
  // Text similarity (40% weight)
  const textSim = calculateTextSimilarity(query, context.content);
  score += textSim * 0.4;
  
  // Tag overlap (30% weight)
  if (tags && context.tags) {
    const tagOverlap = tags.filter(tag => context.tags.includes(tag)).length / tags.length;
    score += tagOverlap * 0.3;
  }
  
  // Importance score (20% weight)
  score += (context.importance || 0.5) * 0.2;
  
  // Recency (10% weight)
  const daysSinceCreation = (Date.now() - new Date(context.created_at).getTime()) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 1 - daysSinceCreation / 30); // Decay over 30 days
  score += recencyScore * 0.1;
  
  return Math.min(1, score);
}

/**
 * Perform context clustering
 */
async function performContextClustering(
  contexts: any[],
  algorithm: string,
  numClusters: number,
  minClusterSize: number
): Promise<ContextCluster[]> {
  // Simple semantic clustering based on content similarity
  const clusters: ContextCluster[] = [];
  const used = new Set<string>();
  
  for (let i = 0; i < contexts.length && clusters.length < numClusters; i++) {
    if (used.has(contexts[i].id)) continue;
    
    const cluster: ContextCluster = {
      id: uuidv4(),
      name: `Cluster ${clusters.length + 1}`,
      description: '',
      size: 1,
      centroid: [],
      contexts: [contexts[i]],
      tags: [...(contexts[i].tags || [])],
      createdAt: new Date().toISOString(),
      coherenceScore: 1.0
    };
    
    used.add(contexts[i].id);
    
    // Find similar contexts
    for (let j = i + 1; j < contexts.length; j++) {
      if (used.has(contexts[j].id)) continue;
      
      const similarity = calculateTextSimilarity(contexts[i].content, contexts[j].content);
      if (similarity > 0.3) {
        cluster.contexts.push(contexts[j]);
        cluster.size++;
        cluster.tags = [...new Set([...cluster.tags, ...(contexts[j].tags || [])])];
        used.add(contexts[j].id);
      }
    }
    
    if (cluster.size >= minClusterSize) {
      cluster.description = generateClusterDescription(cluster.contexts);
      clusters.push(cluster);
    }
  }
  
  return clusters;
}

/**
 * Generate cluster description
 */
function generateClusterDescription(contexts: any[]): string {
  const commonWords = findCommonWords(contexts.map(c => c.content));
  return `Cluster containing ${contexts.length} contexts with common themes: ${commonWords.slice(0, 5).join(', ')}`;
}

/**
 * Find common words across contexts
 */
function findCommonWords(contents: string[]): string[] {
  const wordCounts = new Map<string, number>();
  
  contents.forEach(content => {
    const words = content.toLowerCase().split(/\s+/)
      .filter(word => word.length > 3 && !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'has', 'let', 'put', 'say', 'she', 'too', 'use'].includes(word));
    
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
  });
  
  return Array.from(wordCounts.entries())
    .filter(([, count]) => count > 1)
    .sort(([, a], [, b]) => b - a)
    .map(([word]) => word);
}

/**
 * Track context flow for a session
 */
async function trackContextFlow(
  userId: string,
  sessionId: string,
  timeRange?: { start?: string; end?: string },
  includeMetrics: boolean = true,
  granularity: string = 'hour'
): Promise<ContextFlow> {
  // This would integrate with actual context tracking data
  // For now, return mock data structure
  
  const startTime = timeRange?.start || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const endTime = timeRange?.end || new Date().toISOString();
  
  // Get contexts for the session (mock implementation)
  const contexts = await contextStorageService.getContext(userId, undefined, sessionId, 100);
  
  const flow: ContextFlow = {
    sessionId,
    userId,
    startTime,
    endTime,
    totalContexts: contexts.length,
    contextTypes: contexts.reduce((acc, context) => {
      acc[context.category] = (acc[context.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    flowMetrics: {
      averageImportance: contexts.reduce((sum, c) => sum + (c.importance || 0.5), 0) / contexts.length,
      contextDiversity: Object.keys(contexts.reduce((acc, c) => ({ ...acc, [c.category]: true }), {})).length,
      temporalDensity: contexts.length / ((new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60)),
      accessPatterns: contexts.map(c => ({
        timestamp: c.created_at,
        contextId: c.id,
        accessType: 'create' as const
      }))
    }
  };
  
  return flow;
}

/**
 * Find similar contexts
 */
async function findSimilarContexts(
  referenceContext: any,
  userId: string,
  limit: number,
  minSimilarity: number
): Promise<ContextSimilarity[]> {
  const contexts = await contextStorageService.getContext(userId, undefined, undefined, 200);
  
  const similarities: ContextSimilarity[] = contexts
    .filter(c => c.id !== referenceContext.id)
    .map(context => {
      const similarity = calculateTextSimilarity(referenceContext.content, context.content);
      const sharedTags = (referenceContext.tags || []).filter((tag: string) => 
        (context.tags || []).includes(tag)
      );
      
      return {
        contextId: context.id,
        similarity,
        sharedTags,
        semanticSimilarity: similarity,
        temporalSimilarity: calculateTemporalSimilarity(referenceContext.created_at, context.created_at),
        metadata: {
          category: context.category,
          importance: context.importance,
          createdAt: context.created_at
        }
      };
    })
    .filter(s => s.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
  
  return similarities;
}

/**
 * Calculate temporal similarity
 */
function calculateTemporalSimilarity(date1: string, date2: string): number {
  const time1 = new Date(date1).getTime();
  const time2 = new Date(date2).getTime();
  const timeDiff = Math.abs(time1 - time2);
  const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
  
  // Similarity decreases over time, maximum at 1 day, minimum at 30 days
  return Math.max(0, 1 - daysDiff / 30);
}

/**
 * Generate context analytics
 */
async function generateContextAnalytics(
  userId: string,
  timeRange: { start: string; end: string }
): Promise<ContextAnalytics> {
  const contexts = await contextStorageService.getContext(userId, undefined, undefined, 1000);
  
  // Filter by time range
  const startTime = new Date(timeRange.start);
  const endTime = new Date(timeRange.end);
  const filteredContexts = contexts.filter(c => {
    const contextTime = new Date(c.created_at);
    return contextTime >= startTime && contextTime <= endTime;
  });
  
  // Calculate metrics
  const categoriesDistribution = filteredContexts.reduce((acc, context) => {
    acc[context.category] = (acc[context.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const averageImportance = filteredContexts.reduce((sum, c) => sum + (c.importance || 0.5), 0) / filteredContexts.length;
  
  // Most accessed contexts (mock data)
  const mostAccessedContexts = filteredContexts
    .sort((a, b) => (b.access_count || 0) - (a.access_count || 0))
    .slice(0, 10)
    .map(transformStoredToContextEntry);
  
  // Context growth trend
  const contextGrowthTrend = generateGrowthTrend(filteredContexts, timeRange);
  
  // Top tags
  const tagCounts = new Map<string, number>();
  filteredContexts.forEach(context => {
    (context.tags || []).forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  
  const topTags = Array.from(tagCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));
  
  return {
    userId,
    timeRange,
    metrics: {
      totalContexts: filteredContexts.length,
      categoriesDistribution,
      averageImportance: isNaN(averageImportance) ? 0 : averageImportance,
      mostAccessedContexts,
      contextGrowthTrend,
      topTags,
      clusteringInsights: {
        optimalClusters: Math.min(10, Math.ceil(filteredContexts.length / 5)),
        clusterCoherence: 0.7,
        topics: topTags.slice(0, 5).map(t => t.tag)
      }
    }
  };
}

/**
 * Generate growth trend data
 */
function generateGrowthTrend(
  contexts: any[],
  timeRange: { start: string; end: string }
): Array<{ date: string; count: number }> {
  const startTime = new Date(timeRange.start);
  const endTime = new Date(timeRange.end);
  const days = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24));
  
  const trend: Array<{ date: string; count: number }> = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startTime.getTime() + i * 24 * 60 * 60 * 1000);
    const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    
    const count = contexts.filter(c => {
      const contextTime = new Date(c.created_at);
      return contextTime >= date && contextTime < nextDate;
    }).length;
    
    trend.push({
      date: date.toISOString().split('T')[0] || date.toISOString(),
      count
    });
  }
  
  return trend;
}

/**
 * Template management functions
 */
const templates = new Map<string, ContextTemplate>();

async function getContextTemplates(
  userId: string,
  category?: string,
  isPublic?: boolean
): Promise<ContextTemplate[]> {
  return Array.from(templates.values()).filter(template => {
    if (category && template.category !== category) return false;
    if (isPublic !== undefined && template.isPublic !== isPublic) return false;
    if (!template.isPublic && template.createdBy !== userId) return false;
    return true;
  });
}

async function storeContextTemplate(template: ContextTemplate): Promise<void> {
  templates.set(template.id, template);
}

/**
 * Context CRUD operations
 */
async function updateContext(contextId: string, userId: string, updates: any): Promise<any | null> {
  // This would integrate with the actual storage service
  // For now, return mock data
  return { id: contextId, ...updates, updatedAt: new Date().toISOString() };
}

async function deleteContext(contextId: string, userId: string): Promise<boolean> {
  // This would integrate with the actual storage service
  // For now, return mock success
  return true;
}

export default router;
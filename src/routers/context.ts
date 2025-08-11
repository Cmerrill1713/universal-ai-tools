/**
 * Enhanced Context Router - API endpoints for comprehensive context management
 *
 * Features:
 * - Basic context CRUD operations (existing)
 * - Enhanced context management with automatic persistence
 * - Semantic search and retrieval
 * - Context analytics and monitoring
 * - System health and optimization
 *
 * Implements CLAUDE.md instruction: "Always use supabase for context"
 */

import { Router } from 'express';

import { autoContextMiddleware } from '../middleware/auto-context-middleware';
import { contextAnalyticsService } from '../services/context-analytics-service';
import { contextStorageService } from '../services/context-storage-service';
import { enhancedContextManager } from '../services/enhanced-context-manager';
import { semanticContextRetrievalService } from '../services/semantic-context-retrieval';
import { sendError, sendSuccess } from '../utils/api-response';
import { log,LogContext } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/context/semantic-search
 * Perform semantic search across all context types
 *
 * Placed BEFORE parameterized routes to avoid shadowing by `/:userId`.
 */
router.post('/semantic-search', async (req, res) => {
  try {
    const { query, userId, maxResults, minRelevanceScore, contextTypes, timeWindow, projectPath } =
      req.body;

    if (!query || !userId) {
      return sendError(res, 'VALIDATION_ERROR', 'query and userId are required', 400);
    }

    log.info('🔍 Performing semantic context search', LogContext.API, {
      query: query.substring(0, 50),
      userId: (userId as string).substring(0, 8),
      maxResults,
    });

    const startTime = Date.now();
    const searchResults = await semanticContextRetrievalService.semanticSearch({
      query,
      userId,
      maxResults,
      minRelevanceScore,
      contextTypes,
      timeWindow,
      projectPath,
      fuseSimilarResults: true,
    });
    const searchTime = Date.now() - startTime;

    // Track analytics
    contextAnalyticsService.trackRetrievalEvent(
      searchTime,
      searchResults.results.length,
      searchResults.metrics.averageRelevance
    );

    return sendSuccess(res, {
      results: searchResults.results,
      clusters: searchResults.clusters,
      metrics: searchResults.metrics,
      searchTime,
    });
  } catch (error) {
    log.error('❌ Semantic search failed', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return sendError(res, 'INTERNAL_ERROR', 'Semantic search failed', 500, error);
  }
});

/**
 * POST /api/v1/context/:userId/backfill-embeddings
 * Compute and store embeddings for context rows missing vectors (ANN search enablement)
 * Must be placed BEFORE `/:userId` routes to avoid shadowing.
 */
router.post('/:userId/backfill-embeddings', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit } = req.body || {};

    log.info('🧩 Backfilling context embeddings', LogContext.API, {
      userId,
      limit: limit || 500,
    });

    // Use service helper to fill missing vectors
    const result = await contextStorageService.backfillEmbeddingsForUser(userId, limit || 500);

    return sendSuccess(res, {
      userId,
      updated: result.updated,
      message: 'Embedding backfill completed',
    });
  } catch (error) {
    log.error('❌ Embedding backfill failed', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return sendError(res, 'INTERNAL_ERROR', 'Embedding backfill failed', 500, error);
  }
});

/**
 * GET /api/v1/context/:userId
 * Get all context for a user
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { category, projectPath, limit } = req.query;

    log.info('📖 Retrieving context from Supabase', LogContext.API, {
      userId,
      category,
      projectPath,
      limit,
    });

    const context = await contextStorageService.getContext(
      userId,
      category as string,
      projectPath as string,
      parseInt(limit as string) || 10
    );

    res.json({
      success: true,
      data: {
        context,
        total: context.length,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        userId,
        category: category || 'all',
        projectPath: projectPath || null,
      },
    });
  } catch (error) {
    log.error('❌ Failed to retrieve context', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CONTEXT_RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Failed to retrieve context',
      },
    });
  }
});

/**
 * GET /api/v1/context/:userId/stats
 * Get context statistics for a user
 */
router.get('/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;

    log.info('📊 Getting context statistics', LogContext.API, { userId });

    const stats = await contextStorageService.getContextStats(userId);

    res.json({
      success: true,
      data: stats,
      metadata: {
        timestamp: new Date().toISOString(),
        userId,
      },
    });
  } catch (error) {
    log.error('❌ Failed to get context stats', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CONTEXT_STATS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get context statistics',
      },
    });
  }
});

/**
 * POST /api/v1/context/:userId/search
 * Search context by content
 */
router.post('/:userId/search', async (req, res) => {
  try {
    const { userId } = req.params;
    const { query, category, limit } = req.body;

    if (!query) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_QUERY',
          message: 'Search query is required',
        },
      });
      return;
    }

    log.info('🔍 Searching context in Supabase', LogContext.API, {
      userId,
      query: query.substring(0, 100),
      category,
      limit,
    });

    // For now, use simple text search instead of complex tsquery
    const context = await contextStorageService.getContext(
      userId,
      category,
      undefined,
      limit || 10
    );

    // Simple client-side filtering for better compatibility
    const filteredContext = context.filter(
      (ctx) =>
        ctx.content.toLowerCase().includes(query.toLowerCase()) ||
        ctx.source.toLowerCase().includes(query.toLowerCase())
    );

    res.json({
      success: true,
      data: {
        context: filteredContext,
        total: filteredContext.length,
        searchQuery: query,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        userId,
        category: category || 'all',
      },
    });
  } catch (error) {
    log.error('❌ Failed to search context', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CONTEXT_SEARCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to search context',
      },
    });
  }
});

/**
 * POST /api/v1/context/:userId
 * Store new context entry
 */
router.post('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { content, category, source, projectPath, metadata } = req.body;

    if (!content || !category || !source) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'content, category, and source are required',
        },
      });
      return;
    }

    log.info('💾 Storing context to Supabase', LogContext.API, {
      userId,
      category,
      source,
      contentLength: content.length,
    });

    const contextId = await contextStorageService.storeContext({
      content,
      category,
      source,
      userId,
      projectPath,
      metadata,
    });

    if (contextId) {
      res.json({
        success: true,
        data: {
          contextId,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          userId,
        },
      });
    } else {
      throw new Error('Failed to store context');
    }
  } catch (error) {
    log.error('❌ Failed to store context', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CONTEXT_STORAGE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to store context',
      },
    });
  }
});

// ====================================================================
// ENHANCED CONTEXT MANAGEMENT ENDPOINTS
// ====================================================================

/**
 * POST /api/v1/context/messages
 * Add a message to conversation context with automatic compression
 */
router.post('/messages', async (req, res) => {
  try {
    const { sessionId, role, content, userId, metadata } = req.body;

    // Validate input
    if (!sessionId || !role || !content) {
      return sendError(res, 'VALIDATION_ERROR', 'sessionId, role, and content are required', 400);
    }

    if (!['user', 'assistant', 'system'].includes(role)) {
      return sendError(res, 'VALIDATION_ERROR', 'role must be user, assistant, or system', 400);
    }

    log.info('📝 Adding message to enhanced context', LogContext.API, {
      sessionId: sessionId.substring(0, 8),
      role,
      contentLength: content.length,
      userId: userId || 'anonymous',
    });

    const result = await enhancedContextManager.addMessage(sessionId, {
      role: role as 'user' | 'assistant' | 'system',
      content,
      metadata: {
        userId: userId || 'anonymous',
        endpoint: 'api_context_add',
        ...metadata,
      },
    });

    // Track analytics
    if (result.shouldCompress) {
      contextAnalyticsService.trackCompressionEvent(0.5, 1000);
    }

    return sendSuccess(res, {
      contextId: result.contextId,
      tokenCount: result.tokenCount,
      shouldCompress: result.shouldCompress,
      message: 'Message added to context successfully',
    });
  } catch (error) {
    log.error('❌ Failed to add message to enhanced context', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return sendError(res, 'INTERNAL_ERROR', 'Failed to add message to context', 500, error);
  }
});

/**
 * GET /api/v1/context/enhanced/:sessionId/:userId
 * Get relevant context using enhanced retrieval with compression and summaries
 */
router.get('/enhanced/:sessionId/:userId', async (req, res) => {
  try {
    const { sessionId, userId } = req.params;
    const { maxTokens, relevanceThreshold, includeRecentMessages, includeSummaries, timeWindow } =
      req.query;

    log.info('🔍 Retrieving enhanced context', LogContext.API, {
      sessionId: sessionId.substring(0, 8),
      userId: userId.substring(0, 8),
      maxTokens,
    });

    const options = {
      maxTokens: maxTokens ? parseInt(maxTokens as string) : undefined,
      relevanceThreshold: relevanceThreshold ? parseFloat(relevanceThreshold as string) : undefined,
      includeRecentMessages: includeRecentMessages !== 'false',
      includeSummaries: includeSummaries !== 'false',
      timeWindow: timeWindow ? parseInt(timeWindow as string) : undefined,
    };

    const context = await enhancedContextManager.getRelevantContext(sessionId, userId, options);

    return sendSuccess(res, {
      messages: context.messages,
      summaries: context.summaries,
      totalTokens: context.totalTokens,
      source: context.source,
      metadata: {
        retrievalTime: new Date().toISOString(),
        tokenLimit: options.maxTokens || 8000,
        relevanceThreshold: options.relevanceThreshold || 0.3,
      },
    });
  } catch (error) {
    log.error('❌ Failed to retrieve enhanced context', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return sendError(res, 'INTERNAL_ERROR', 'Failed to retrieve enhanced context', 500, error);
  }
});

/**
 * POST /api/v1/context/semantic-search
 * Perform semantic search across all context types
 */
router.post('/semantic-search', async (req, res) => {
  try {
    const { query, userId, maxResults, minRelevanceScore, contextTypes, timeWindow, projectPath } =
      req.body;

    if (!query || !userId) {
      return sendError(res, 'VALIDATION_ERROR', 'query and userId are required', 400);
    }

    log.info('🔍 Performing semantic context search', LogContext.API, {
      query: query.substring(0, 50),
      userId: userId.substring(0, 8),
      maxResults,
    });

    const startTime = Date.now();
    const searchResults = await semanticContextRetrievalService.semanticSearch({
      query,
      userId,
      maxResults,
      minRelevanceScore,
      contextTypes,
      timeWindow,
      projectPath,
      fuseSimilarResults: true,
    });
    const searchTime = Date.now() - startTime;

    // Track analytics
    contextAnalyticsService.trackRetrievalEvent(
      searchTime,
      searchResults.results.length,
      searchResults.metrics.averageRelevance
    );

    return sendSuccess(res, {
      results: searchResults.results,
      clusters: searchResults.clusters,
      metrics: searchResults.metrics,
      searchTime,
    });
  } catch (error) {
    log.error('❌ Semantic search failed', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return sendError(res, 'INTERNAL_ERROR', 'Semantic search failed', 500, error);
  }
});

/**
 * GET /api/v1/context/analytics/metrics
 * Get current system metrics
 */
router.get('/analytics/metrics', async (req, res) => {
  try {
    const metrics = await contextAnalyticsService.getCurrentMetrics();
    return sendSuccess(res, { metrics });
  } catch (error) {
    return sendError(res, 'INTERNAL_ERROR', 'Failed to get analytics metrics', 500, error);
  }
});

/**
 * GET /api/v1/context/analytics/user/:analyticsUserId
 * Get analytics for a specific user
 */
router.get('/analytics/user/:analyticsUserId', async (req, res) => {
  try {
    const { analyticsUserId } = req.params;
    const { timeWindow } = req.query;

    const analytics = await contextAnalyticsService.getUserAnalytics(
      analyticsUserId,
      timeWindow ? parseInt(timeWindow as string) : undefined
    );

    return sendSuccess(res, { analytics, userId: analyticsUserId });
  } catch (error) {
    return sendError(res, 'INTERNAL_ERROR', 'Failed to get user analytics', 500, error);
  }
});

/**
 * GET /api/v1/context/analytics/compression
 * Get compression analytics
 */
router.get('/analytics/compression', async (req, res) => {
  try {
    const { timeWindow } = req.query;
    const analytics = await contextAnalyticsService.getCompressionAnalytics(
      timeWindow ? parseInt(timeWindow as string) : undefined
    );
    return sendSuccess(res, { analytics });
  } catch (error) {
    return sendError(res, 'INTERNAL_ERROR', 'Failed to get compression analytics', 500, error);
  }
});

/**
 * GET /api/v1/context/health
 * Get system health metrics
 */
router.get('/health', async (req, res) => {
  try {
    const health = await contextAnalyticsService.getSystemHealth();

    // Determine overall health status
    const systems = [
      health.contextManager,
      health.semanticRetrieval,
      health.database,
      health.middleware,
    ];
    const criticalCount = systems.filter((s) => s.status === 'critical').length;
    const warningCount = systems.filter((s) => s.status === 'warning').length;

    let overallStatus: 'healthy' | 'warning' | 'critical';
    if (criticalCount > 0) {
      overallStatus = 'critical';
    } else if (warningCount > 1) {
      overallStatus = 'critical';
    } else if (warningCount > 0) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'healthy';
    }

    return sendSuccess(res, {
      overallStatus,
      systems: health,
    });
  } catch (error) {
    return sendError(res, 'INTERNAL_ERROR', 'Failed to get system health', 500, error);
  }
});

/**
 * GET /api/v1/context/optimization
 * Get cost optimization recommendations
 */
router.get('/optimization', async (req, res) => {
  try {
    const optimization = await contextAnalyticsService.getCostOptimization();
    return sendSuccess(res, { optimization });
  } catch (error) {
    return sendError(
      res,
      'INTERNAL_ERROR',
      'Failed to get optimization recommendations',
      500,
      error
    );
  }
});

/**
 * POST /api/v1/context/compress/:contextId
 * Manually compress a specific context
 */
router.post('/compress/:contextId', async (req, res) => {
  try {
    const { contextId } = req.params;
    const success = await enhancedContextManager.compressContextById(contextId);

    if (!success) {
      return sendError(res, 'NOT_FOUND', 'Context not found or compression failed', 404);
    }

    // Track compression event
    contextAnalyticsService.trackCompressionEvent(0.6, 2000);

    return sendSuccess(res, {
      contextId,
      compressed: true,
      message: 'Context compressed successfully',
    });
  } catch (error) {
    return sendError(res, 'INTERNAL_ERROR', 'Failed to compress context', 500, error);
  }
});

/**
 * GET /api/v1/context/system-stats
 * Get overall system statistics
 */
router.get('/system-stats', async (req, res) => {
  try {
    const [contextManagerStats, middlewareStats, cacheStats] = await Promise.all([
      enhancedContextManager.getStats(),
      autoContextMiddleware.getStats(),
      semanticContextRetrievalService.getCacheStats(),
    ]);

    const stats = {
      contextManager: contextManagerStats,
      middleware: middlewareStats,
      semanticCache: cacheStats,
      overview: {
        totalActiveContexts: contextManagerStats.activeContexts,
        totalActiveSessions: middlewareStats.activeSessions,
        totalMessages: contextManagerStats.totalMessages,
        totalTokens: contextManagerStats.totalTokens,
        averageCompression: contextManagerStats.averageCompression,
        cacheHitRate: cacheStats.hitRate,
        cacheMemoryUsage: cacheStats.memoryUsage,
      },
      lastUpdated: new Date().toISOString(),
    };

    return sendSuccess(res, stats);
  } catch (error) {
    return sendError(res, 'INTERNAL_ERROR', 'Failed to get system stats', 500, error);
  }
});

/**
 * DELETE /api/v1/context/clear-cache
 * Clear semantic retrieval cache
 */
router.delete('/clear-cache', async (req, res) => {
  try {
    semanticContextRetrievalService.clearCache();
    return sendSuccess(res, {
      message: 'Semantic retrieval cache cleared successfully',
    });
  } catch (error) {
    return sendError(res, 'INTERNAL_ERROR', 'Failed to clear cache', 500, error);
  }
});

export default router;

/**
 * Context Router - API endpoints for accessing stored context from Supabase
 * Implements CLAUDE.md instruction: "Always use supabase for context"
 */

import { Router } from 'express';
import type { Request, Response} from 'express';
import { NextFunction } from 'express';

import { LogContext, log } from '@/utils/logger';
import { contextStorageService } from '@/services/context-storage-service';

const router = Router();

/**
 * GET /api/v1/context/:userId
 * Get all context for a user
 */
router.get('/:userId', async (req: Request, res: Response) => {
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
router.get('/:userId/stats', async (req: Request, res: Response) => {
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
router.post('/:userId/search', async (req: Request, res: Response) => {
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
router.post('/:userId', async (req: Request, res: Response) => {
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

export default router;

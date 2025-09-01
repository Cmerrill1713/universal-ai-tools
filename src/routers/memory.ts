/**
 * Memory Router - Manages AI memory storage and retrieval
 * Provides CRUD operations for memories with vector search capabilities
 */

import type { Request, Response } from 'express';
import { NextFunction, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LogContext, log } from '@/utils/logger';
import { authenticate } from '@/middleware/auth';
import { validateRequest } from '@/middleware/express-validator';
import { body, param, query } from 'express-validator';
import { MemoryValidationMiddleware } from '@/middleware/memory-validation';

interface Memory {
  id: string;
  userId: string;
  content: string;
  type: 'conversation' | 'knowledge' | 'context' | 'preference';
  metadata: {
    source?: string;
    agentName?: string;
    timestamp: string;
    tags?: string[];
    importance?: number;
    accessCount: number;
    lastAccessed?: string;
  };
  embedding?: number[]; // Vector embedding for similarity search
}

interface SearchResult {
  memory: Memory;
  score: number;
  distance?: number;
}

// In-memory storage for now (should be moved to vector database)
const memories: Map<string, Memory> = new Map();

const router = Router();

/**
 * GET /api/v1/memory/health
 * Health check endpoint for memory service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const totalMemories = memories.size;
    const memorysByType = Array.from(memories.values()).reduce((acc, memory) => {
      acc[memory.type] = (acc[memory.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return res.json({
      success: true,
      status: 'healthy',
      data: {
        service: 'memory',
        totalMemories,
        memorysByType,
        validationRulesActive: MemoryValidationMiddleware.bestPractices ? 
          MemoryValidationMiddleware.bestPractices.getRules().length : 0,
        storageType: 'in-memory',
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || uuidv4(),
      },
    });
  } catch (error) {
    log.error('Memory health check failed', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: {
        code: 'MEMORY_HEALTH_ERROR',
        message: 'Memory health check failed',
      },
    });
  }
});

/**
 * GET /api/v1/memory
 * List all memories for a user
 */
router.get(
  '/',
  authenticate,
  [
    query('type').optional().isIn(['conversation', 'knowledge', 'context', 'preference']),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  ],
  validateRequest,
  MemoryValidationMiddleware.addValidationReport,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || 'anonymous';
      const { type, limit = 50, offset = 0 } = req.query;

      let userMemories = Array.from(memories.values()).filter((memory) => memory.userId === userId);

      // Filter by type if specified
      if (type) {
        userMemories = userMemories.filter((memory) => memory.type === type);
      }

      // Sort by timestamp (newest first)
      userMemories.sort(
        (a, b) =>
          new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime()
      );

      // Apply pagination
      const paginatedMemories = userMemories.slice(Number(offset), Number(offset) + Number(limit));

      return res.json({
        success: true,
        data: {
          memories: paginatedMemories.map((memory) => ({
            id: memory.id,
            content: memory.content,
            type: memory.type,
            metadata: memory.metadata,
          })),
          pagination: {
            total: userMemories.length,
            limit: Number(limit),
            offset: Number(offset),
            hasMore: Number(offset) + Number(limit) < userMemories.length,
          },
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log.error('Failed to list memories', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'MEMORY_LIST_ERROR',
          message: 'Failed to retrieve memories',
        },
      });
    }
  }
);

/**
 * GET /api/v1/memory/search
 * Search memories by query (must come before /:id route)
 */
router.get('/search', authenticate, async (req: Request, res: Response) => {
  try {
    const { query, limit = 10 } = req.query;
    const userId = (req as any).user?.id || 'anonymous';

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Search query is required',
        },
      });
    }

    // Simple search implementation - filter memories by content match
    const searchResults = Array.from(memories.values())
      .filter(memory => 
        memory.userId === userId && 
        memory.content.toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) => new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime())
      .slice(0, Number(limit));

    return res.json({
      success: true,
      data: {
        memories: searchResults,
        query,
        total: searchResults.length,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || uuidv4(),
      },
    });
  } catch (error) {
    log.error('Failed to search memories', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'MEMORY_SEARCH_ERROR',
        message: 'Failed to search memories',
      },
    });
  }
});

/**
 * GET /api/v1/memory/:id
 * Get a specific memory
 */
router.get(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid memory ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id || 'anonymous';

      const memory = memories.get(id || '');
      if (!memory) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'MEMORY_NOT_FOUND',
            message: 'Memory not found',
          },
        });
      }

      // Check authorization
      if (memory.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'You do not have access to this memory',
          },
        });
      }

      // Update access metadata
      memory.metadata.accessCount++;
      memory.metadata.lastAccessed = new Date().toISOString();

      return res.json({
        success: true,
        data: {
          id: memory.id,
          content: memory.content,
          type: memory.type,
          metadata: memory.metadata,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log.error('Failed to get memory', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
        memoryId: req.params.id,
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'MEMORY_GET_ERROR',
          message: 'Failed to retrieve memory',
        },
      });
    }
  }
);

/**
 * POST /api/v1/memory
 * Create a new memory
 */
router.post(
  '/',
  authenticate,
  [
    body('content').isString().withMessage('Content is required'),
    body('type')
      .isIn(['conversation', 'knowledge', 'context', 'preference'])
      .withMessage('Invalid memory type'),
    body('metadata').optional().isObject().withMessage('Metadata must be an object'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('importance')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('Importance must be between 0 and 1'),
    body('enforceRules').optional().isBoolean().withMessage('Enforce rules must be boolean'),
    body('autoFix').optional().isBoolean().withMessage('Auto fix must be boolean'),
  ],
  validateRequest,
  MemoryValidationMiddleware.validateMemoryCreation,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || 'anonymous';
      const { content, type, metadata = {}, tags = [], importance = 0.5 } = req.body;

      const memory: Memory = {
        id: uuidv4(),
        userId,
        content,
        type,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          tags,
          importance,
          accessCount: 0,
        },
      };

      // TODO: Generate vector embedding for the content
      // memory.embedding = await generateEmbedding(content);

      memories.set(memory.id, memory);

      log.info('Memory created', LogContext.API, {
        memoryId: memory.id,
        type: memory.type,
        userId,
      });

      return res.json({
        success: true,
        data: {
          id: memory.id,
          message: 'Memory created successfully',
          validationReport: (req as any).memoryValidation || null,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log.error('Failed to create memory', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'MEMORY_CREATE_ERROR',
          message: 'Failed to create memory',
        },
      });
    }
  }
);

/**
 * PUT /api/v1/memory/:id
 * Update a memory
 */
router.put(
  '/:id',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid memory ID'),
    body('content').optional().isString().withMessage('Content must be a string'),
    body('metadata').optional().isObject().withMessage('Metadata must be an object'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('importance')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('Importance must be between 0 and 1'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id || 'anonymous';
      const updates = req.body;

      const memory = memories.get(id || '');
      if (!memory) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'MEMORY_NOT_FOUND',
            message: 'Memory not found',
          },
        });
      }

      // Check authorization
      if (memory.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'You do not have access to this memory',
          },
        });
      }

      // Update memory
      if (updates.content) {
        memory.content = updates.content;
        // TODO: Regenerate embedding
        // memory.embedding = await generateEmbedding(updates.content);
      }

      if (updates.metadata) {
        memory.metadata = { ...memory.metadata, ...updates.metadata };
      }

      if (updates.tags) {
        memory.metadata.tags = updates.tags;
      }

      if (updates.importance !== undefined) {
        memory.metadata.importance = updates.importance;
      }

      log.info('Memory updated', LogContext.API, {
        memoryId: id,
        userId,
      });

      return res.json({
        success: true,
        data: {
          id: memory.id,
          message: 'Memory updated successfully',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log.error('Failed to update memory', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
        memoryId: req.params.id,
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'MEMORY_UPDATE_ERROR',
          message: 'Failed to update memory',
        },
      });
    }
  }
);

/**
 * DELETE /api/v1/memory/:id
 * Delete a memory
 */
router.delete(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid memory ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id || 'anonymous';

      const memory = memories.get(id || '');
      if (!memory) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'MEMORY_NOT_FOUND',
            message: 'Memory not found',
          },
        });
      }

      // Check authorization
      if (memory.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'You do not have access to this memory',
          },
        });
      }

      if (id) {
        memories.delete(id);
      }

      log.info('Memory deleted', LogContext.API, {
        memoryId: id,
        userId,
      });

      return res.json({
        success: true,
        data: {
          message: 'Memory deleted successfully',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log.error('Failed to delete memory', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
        memoryId: req.params.id,
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'MEMORY_DELETE_ERROR',
          message: 'Failed to delete memory',
        },
      });
    }
  }
);

/**
 * POST /api/v1/memory/search
 * Search memories by content similarity
 */
router.post(
  '/search',
  authenticate,
  [
    body('query').isString().withMessage('Query is required'),
    body('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    body('threshold')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('Threshold must be between 0 and 1'),
    body('types').optional().isArray().withMessage('Types must be an array'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || 'anonymous';
      const { query, limit = 10, threshold = 0.7, types = [] } = req.body;

      // Get user memories
      let userMemories = Array.from(memories.values()).filter((memory) => memory.userId === userId);

      // Filter by types if specified
      if (types.length > 0) {
        userMemories = userMemories.filter((memory) => types.includes(memory.type));
      }

      // TODO: Implement actual vector similarity search
      // For now, do simple text matching
      const searchResults: SearchResult[] = userMemories
        .map((memory) => {
          const content = memory.content.toLowerCase();
          const searchQuery = query.toLowerCase();
          const words = searchQuery.split(' ');

          // Calculate simple relevance score
          let score = 0;
          for (const word of words) {
            if (content.includes(word)) {
              score += 1 / words.length;
            }
          }

          return {
            memory,
            score,
            distance: 1 - score, // Convert to distance metric
          };
        })
        .filter((result) => result.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return res.json({
        success: true,
        data: {
          results: searchResults.map((result) => ({
            memory: {
              id: result.memory.id,
              content: result.memory.content,
              type: result.memory.type,
              metadata: result.memory.metadata,
            },
            score: result.score,
            distance: result.distance,
          })),
          query,
          resultsFound: searchResults.length,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log.error('Memory search failed', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'MEMORY_SEARCH_ERROR',
          message: 'Failed to search memories',
        },
      });
    }
  }
);

/**
 * GET /api/v1/memory/validation/stats
 * Get memory validation statistics
 */
router.get('/validation/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const stats = MemoryValidationMiddleware.getValidationStats();
    
    return res.json({
      success: true,
      data: {
        ...stats,
        rules: MemoryValidationMiddleware.bestPractices ? 
          MemoryValidationMiddleware.bestPractices.getRules().length : 0
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || uuidv4(),
      }
    });
  } catch (error) {
    log.error('Failed to get validation stats', LogContext.API, { error });
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'VALIDATION_STATS_ERROR',
        message: 'Failed to retrieve validation statistics'
      }
    });
  }
});

/**
 * POST /api/v1/memory/bulk
 * Create multiple memories at once
 */
router.post(
  '/bulk',
  authenticate,
  [
    body('memories')
      .isArray({ min: 1, max: 100 })
      .withMessage('Memories array is required (1-100 items)'),
    body('memories.*.content').isString().withMessage('Each memory must have content'),
    body('memories.*.type')
      .isIn(['conversation', 'knowledge', 'context', 'preference'])
      .withMessage('Each memory must have a valid type'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || 'anonymous';
      const { memories: memoryData } = req.body;

      const createdMemories: Memory[] = [];

      for (const data of memoryData) {
        const memory: Memory = {
          id: uuidv4(),
          userId,
          content: data.content,
          type: data.type,
          metadata: {
            ...data.metadata,
            timestamp: new Date().toISOString(),
            tags: data.tags || [],
            importance: data.importance || 0.5,
            accessCount: 0,
          },
        };

        memories.set(memory.id, memory);
        createdMemories.push(memory);
      }

      log.info('Bulk memories created', LogContext.API, {
        count: createdMemories.length,
        userId,
      });

      return res.json({
        success: true,
        data: {
          created: createdMemories.length,
          memories: createdMemories.map((m) => ({ id: m.id, type: m.type })),
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log.error('Failed to create bulk memories', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'MEMORY_BULK_ERROR',
          message: 'Failed to create memories',
        },
      });
    }
  }
);

export default router;

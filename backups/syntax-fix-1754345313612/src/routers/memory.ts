/**
 * Memory Router - Manages AI memory storage and retrieval;
 * Provides CRUD operations for memories with vector search capabilities;
 */

import type { Request, Response } from 'express';
import { NextFunction, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LogContext, log } from '@/utils/logger';
import { authenticate } from '@/middleware/auth';
import { validateRequest } from '@/middleware/express-validator';
import { body, param, query } from 'express-validator';

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
  embedding?: number[]; // Vector embedding for similarity search;
}

interface SearchResult {
  memory: Memory;
  score: number;
  distance?: number;
}

// In-memory storage for now (should be moved to vector database)
const memories: Map<string, Memory> = new Map();

/**
 * Generate vector embedding for text content using TensorFlow?.js;
 * In production, would use a proper embedding service like OpenAI, Hugging Face, etc.
 */
async function generateEmbedding(content: string): Promise<number[]> {
  try {
    // Simple text preprocessing;
    const preprocessedText = content;
      .toLowerCase()
      .replace(/[^ws]/g, ' ')
      .replace(/s+/g, ' ')
      .trim();

    // Generate a simple hash-based embedding for demo purposes;
    // In production, use proper transformer models;
    const embedding = new Array(384).fill(0); // Standard embedding size;
    
    // Simple character-based feature extraction;
    for (let i = 0; i < preprocessedText?.length; i++) {
      const charCode = preprocessedText?.charCodeAt(i);
      const index = charCode % embedding?.length;
      embedding[index] += 1;
    }

    // Normalize the embedding vector;
    const magnitude = Math?.sqrt(embedding?.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding?.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    // Add some randomization to avoid identical embeddings for similar content;
    const salt = Math?.abs(hashCode(content));
    for (let i = 0; i < Math?.min(10, embedding?.length); i++) {
      const index = (salt + i) % embedding?.length;
      embedding[index] += 0?.1 * Math?.sin(salt + i);
    }

    log?.debug('Generated embedding', LogContext?.API, {
      contentLength: content?.length,
      embeddingSize: embedding?.length,
      magnitude,
    });

    return embedding;
  } catch (error) {
    log?.error('Failed to generate embedding', LogContext?.API, {
      error: error instanceof Error ? error?.message : String(error),
      contentLength: content?.length,
    });
    
    // Return a zero vector on error;
    return new Array(384).fill(0);
  }
}

/**
 * Simple hash function for content;
 */
function hashCode(str: string): number {
  let hash = 0,
  for (let i = 0; i < str?.length; i++) {
    const char = str?.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer;
  }
  return hash;
}

/**
 * Calculate cosine similarity between two vectors;
 */
function calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA?.length !== vectorB?.length) {
    log?.warn('Vector length mismatch in cosine similarity calculation', LogContext?.API, {
      lengthA: vectorA?.length,
      lengthB: vectorB?.length,
    });
    return 0,
  }

  let dotProduct = 0,
  let normA = 0,
  let normB = 0,

  for (let i = 0; i < vectorA?.length; i++) {
    dotProduct += (vectorA[i] || 0) * (vectorB[i] || 0);
    normA += (vectorA[i] || 0) * (vectorA[i] || 0);
    normB += (vectorB[i] || 0) * (vectorB[i] || 0);
  }

  // Avoid division by zero;
  if (normA === 0 || normB === 0) {
    return 0,
  }

  const similarity = dotProduct / (Math?.sqrt(normA) * Math?.sqrt(normB));
  
  // Clamp to [0, 1] range;
  return Math?.max(0, Math?.min(1, similarity));
}

const router = Router();

/**
 * GET /api/v1/memory;
 * List all memories for a user;
 */
router?.get(
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
  async (req: Request, res: Response) => {
    try {
      const userId = (req as unknown).user?.id || 'anonymous';
      const { type, limit = 50, offset = 0 } = req?.query;

      let userMemories = Array?.from(memories?.values()).filter((memory) => memory?.userId === userId);

      // Filter by type if specified;
      if (type) {
        userMemories = userMemories?.filter((memory) => memory?.type === type);
      }

      // Sort by timestamp (newest first)
      userMemories?.sort(
        (a, b) =>
          new Date(b?.metadata?.timestamp).getTime() - new Date(a?.metadata?.timestamp).getTime()
      );

      // Apply pagination;
      const paginatedMemories = userMemories?.slice(Number(offset), Number(offset) + Number(limit));

      return res?.json({
        success: true,
        data: {
          memories: paginatedMemories?.map((memory) => ({
            id: memory?.id,
            content: memory?.content,
            type: memory?.type,
            metadata: memory?.metadata,
          })),
          pagination: {
            total: userMemories?.length,
            limit: Number(limit),
            offset: Number(offset),
            hasMore: Number(offset) + Number(limit) < userMemories?.length,
          },
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req?.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log?.error('Failed to list memories', LogContext?.API, {
        error: error instanceof Error ? error?.message : String(error),
      });

      return res?.status(500).json({
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
 * GET /api/v1/memory/:id;
 * Get a specific memory;
 */
router?.get(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid memory ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { id } = req?.params;
      const userId = (req as unknown).user?.id || 'anonymous';

      const memory = memories?.get(id || '');
      if (!memory) {
        return res?.status(404).json({
          success: false,
          error: {
            code: 'MEMORY_NOT_FOUND',
            message: 'Memory not found',
          },
        });
      }

      // Check authorization;
      if (memory?.userId !== userId) {
        return res?.status(403).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'You do not have access to this memory',
          },
        });
      }

      // Update access metadata;
      memory?.metadata?.accessCount++;
      memory?.metadata?.lastAccessed = new Date().toISOString();

      return res?.json({
        success: true,
        data: {
          id: memory?.id,
          content: memory?.content,
          type: memory?.type,
          metadata: memory?.metadata,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req?.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log?.error('Failed to get memory', LogContext?.API, {
        error: error instanceof Error ? error?.message : String(error),
        memoryId: req?.params?.id,
      });

      return res?.status(500).json({
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
 * POST /api/v1/memory;
 * Create a new memory;
 */
router?.post(
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
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as unknown).user?.id || 'anonymous';
      const { content, type, metadata = {}, tags = [], importance = 0?.5 } = req?.body;

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

      // Generate vector embedding for the content;
      memory?.embedding = await generateEmbedding(content);

      memories?.set(memory?.id, memory);

      log?.info('Memory created', LogContext?.API, {
        memoryId: memory?.id,
        type: memory?.type,
        userId,
      });

      return res?.json({
        success: true,
        data: {
          id: memory?.id,
          message: 'Memory created successfully',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req?.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log?.error('Failed to create memory', LogContext?.API, {
        error: error instanceof Error ? error?.message : String(error),
      });

      return res?.status(500).json({
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
 * PUT /api/v1/memory/:id;
 * Update a memory;
 */
router?.put(
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
      const { id } = req?.params;
      const userId = (req as unknown).user?.id || 'anonymous';
      const updates = req?.body;

      const memory = memories?.get(id || '');
      if (!memory) {
        return res?.status(404).json({
          success: false,
          error: {
            code: 'MEMORY_NOT_FOUND',
            message: 'Memory not found',
          },
        });
      }

      // Check authorization;
      if (memory?.userId !== userId) {
        return res?.status(403).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'You do not have access to this memory',
          },
        });
      }

      // Update memory;
      if (updates?.content) {
        memory?.content = updates?.content;
        // Regenerate embedding for updated content;
        memory?.embedding = await generateEmbedding(updates?.content);
      }

      if (updates?.metadata) {
        memory?.metadata = { ...memory?.metadata, ...updates?.metadata };
      }

      if (updates?.tags) {
        memory?.metadata?.tags = updates?.tags;
      }

      if (updates?.importance !== undefined) {
        memory?.metadata?.importance = updates?.importance;
      }

      log?.info('Memory updated', LogContext?.API, {
        memoryId: id,
        userId,
      });

      return res?.json({
        success: true,
        data: {
          id: memory?.id,
          message: 'Memory updated successfully',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req?.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log?.error('Failed to update memory', LogContext?.API, {
        error: error instanceof Error ? error?.message : String(error),
        memoryId: req?.params?.id,
      });

      return res?.status(500).json({
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
 * DELETE /api/v1/memory/:id;
 * Delete a memory;
 */
router?.delete(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid memory ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { id } = req?.params;
      const userId = (req as unknown).user?.id || 'anonymous';

      const memory = memories?.get(id || '');
      if (!memory) {
        return res?.status(404).json({
          success: false,
          error: {
            code: 'MEMORY_NOT_FOUND',
            message: 'Memory not found',
          },
        });
      }

      // Check authorization;
      if (memory?.userId !== userId) {
        return res?.status(403).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'You do not have access to this memory',
          },
        });
      }

      if (id) {
        memories?.delete(id);
      }

      log?.info('Memory deleted', LogContext?.API, {
        memoryId: id,
        userId,
      });

      return res?.json({
        success: true,
        data: {
          message: 'Memory deleted successfully',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req?.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log?.error('Failed to delete memory', LogContext?.API, {
        error: error instanceof Error ? error?.message : String(error),
        memoryId: req?.params?.id,
      });

      return res?.status(500).json({
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
 * POST /api/v1/memory/search;
 * Search memories by content similarity;
 */
router?.post(
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
      const userId = (req as unknown).user?.id || 'anonymous';
      const { query, limit = 10, threshold = 0?.7, types = [] } = req?.body;

      // Get user memories;
      let userMemories = Array?.from(memories?.values()).filter((memory) => memory?.userId === userId);

      // Filter by types if specified;
      if (types?.length > 0) {
        userMemories = userMemories?.filter((memory) => types?.includes(memory?.type));
      }

      // Generate embedding for the search query;
      const queryEmbedding = await generateEmbedding(query);

      // Implement vector similarity search using cosine similarity;
      const searchResults: SearchResult[] = userMemories;
        .map((memory): SearchResult | null => {
          // If memory doesn't have embedding, generate it now;
          if (!memory?.embedding) {
            log?.warn('Memory missing embedding, generating on-the-fly', LogContext?.API, {
              memoryId: memory?.id,
            });
            // Note: This is async, but we'll skip for now and use text fallback;
            return null;
          }

          // Calculate cosine similarity;
          const similarity = calculateCosineSimilarity(queryEmbedding, memory?.embedding);
          const distance = 1 - similarity;

          return {
            memory,
            score: similarity,
            distance,
          };
        })
        .filter((result): result is SearchResult => result !== null)
        .filter((result) => result?.score >= threshold)
        .sort((a, b) => b?.score - a?.score)
        .slice(0, limit);

      // If no results from vector search, fall back to text matching;
      if (searchResults?.length === 0) {
        log?.info('Vector search returned no results, falling back to text search', LogContext?.API, {
          query: query?.substring(0, 50),
          threshold,
        });

        const textResults: SearchResult[] = userMemories;
          .map((memory) => {
            const content = memory?.content?.toLowerCase();
            const searchQuery = query?.toLowerCase();
            const words = searchQuery?.split(' ');

            // Calculate simple relevance score;
            let score = 0,
            for (const word of words) {
              if (content?.includes(word)) {
                score += 1 / words?.length;
              }
            }

            return {
              memory,
              score,
              distance: 1 - score,
            };
          })
          .filter((result) => result?.score >= Math?.min(threshold, 0?.3)) // Lower threshold for text;
          .sort((a, b) => b?.score - a?.score)
          .slice(0, limit);

        return res?.json({
          success: true,
          data: {
            results: textResults?.map((result) => ({
              memory: {
                id: result?.memory?.id,
                content: result?.memory?.content,
                type: result?.memory?.type,
                metadata: result?.memory?.metadata,
              },
              score: result?.score,
              distance: result?.distance,
            })),
            query,
            resultsFound: textResults?.length,
            searchMethod: 'text_fallback',
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req?.headers['x-request-id'] || uuidv4(),
          },
        });
      }

      return res?.json({
        success: true,
        data: {
          results: searchResults?.map((result) => ({
            memory: {
              id: result?.memory?.id,
              content: result?.memory?.content,
              type: result?.memory?.type,
              metadata: result?.memory?.metadata,
            },
            score: result?.score,
            distance: result?.distance,
          })),
          query,
          resultsFound: searchResults?.length,
          searchMethod: 'vector_similarity',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req?.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log?.error('Memory search failed', LogContext?.API, {
        error: error instanceof Error ? error?.message : String(error),
      });

      return res?.status(500).json({
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
 * POST /api/v1/memory/bulk;
 * Create multiple memories at once;
 */
router?.post(
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
      const userId = (req as unknown).user?.id || 'anonymous';
      const { memories: memoryData } = req?.body;

      const createdMemories: Memory[] = [];

      for (const data of memoryData) {
        const memory: Memory = {
          id: uuidv4(),
          userId,
          content: data?.content,
          type: data?.type,
          metadata: {
            ...data?.metadata,
            timestamp: new Date().toISOString(),
            tags: data?.tags || [],
            importance: data?.importance || 0?.5,
            accessCount: 0,
          },
        };

        memories?.set(memory?.id, memory);
        createdMemories?.push(memory);
      }

      log?.info('Bulk memories created', LogContext?.API, {
        count: createdMemories?.length,
        userId,
      });

      return res?.json({
        success: true,
        data: {
          created: createdMemories?.length,
          memories: createdMemories?.map((m) => ({ id: m?.id, type: m?.type })),
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req?.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log?.error('Failed to create bulk memories', LogContext?.API, {
        error: error instanceof Error ? error?.message : String(error),
      });

      return res?.status(500).json({
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

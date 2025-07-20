import { Router, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger, LogContext } from '../utils/enhanced-logger';
import { 
  sendSuccess, 
  sendError, 
  sendPaginatedSuccess,
  createPaginationMeta,
  apiResponseMiddleware 
} from '../utils/api-response';
import type { 
  Memory, 
  MemorySearchRequest, 
  MemorySearchResponse,
  ErrorCode 
} from '../types';

// Define extended Request interface
interface AuthenticatedRequest extends Request {
  user?: { id: string };
  id?: string;
  validatedData?: any;
  aiService?: { service_name: string };
  requestId?: string;
  apiResponse?: any;
}

export function MemoryRouter(supabase: SupabaseClient) {
  const router = Router();
  
  // Apply API response middleware to all routes
  router.use(apiResponseMiddleware);

  // Enhanced validation middleware with proper error responses
  const validateMemoryStore = (req: AuthenticatedRequest, res: Response, next: any) => {
    const { content, metadata, tags } = req.body;
    
    if (!content) {
      return sendError(res, 'MISSING_REQUIRED_FIELD' as ErrorCode, 'Content is required', 400);
    }
    
    if (typeof content !== 'string' || content.length === 0) {
      return sendError(res, 'INVALID_FORMAT' as ErrorCode, 'Content must be a non-empty string', 400);
    }
    
    if (content.length > 10000) {
      return sendError(res, 'REQUEST_TOO_LARGE' as ErrorCode, 'Content cannot exceed 10,000 characters', 413);
    }
    
    req.validatedData = { 
      content: content.trim(), 
      metadata: metadata || {}, 
      tags: Array.isArray(tags) ? tags : [] 
    };
    next();
  };

  const validateMemorySearch = (req: AuthenticatedRequest, res: Response, next: any) => {
    const { query, limit = 10, filters = {} } = req.body;
    
    if (!query) {
      return sendError(res, 'MISSING_REQUIRED_FIELD' as ErrorCode, 'Query is required', 400);
    }
    
    if (typeof query !== 'string' || query.trim().length === 0) {
      return sendError(res, 'INVALID_FORMAT' as ErrorCode, 'Query must be a non-empty string', 400);
    }
    
    const validatedLimit = Math.min(Math.max(1, parseInt(limit) || 10), 100);
    
    req.validatedData = { 
      query: query.trim(), 
      limit: validatedLimit, 
      filters: filters || {} 
    };
    next();
  };

  // Store memory
  router.post('/', validateMemoryStore, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const memoryData = req.validatedData;

      // Generate embedding if content is provided
      let embedding: number[] | null = null;
      try {
        const embeddingResult = await supabase.rpc('ai_generate_embedding', {
          content: memoryData.content
        });
        embedding = embeddingResult.data;
      } catch (embeddingError) {
        logger.warn('Failed to generate embedding, storing without it', LogContext.API, { 
          error: embeddingError instanceof Error ? embeddingError.message : String(embeddingError),
          content: memoryData.content.substring(0, 100) 
        });
      }

      const { data, error } = await supabase
        .from('memories')
        .insert({
          content: memoryData.content,
          metadata: memoryData.metadata,
          user_id: req.user?.id || 'anonymous',
          embedding: embedding,
          tags: memoryData.tags,
          type: 'semantic',
          importance: 0.5,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to store memory', LogContext.API, { error: error.message, memoryData });
        return sendError(res, 'MEMORY_STORAGE_ERROR' as ErrorCode, 'Failed to store memory', 500, error.message);
      }

      // Transform to our Memory type
      const memory: Memory = {
        id: data.id,
        type: data.type || 'semantic',
        content: data.content,
        metadata: data.metadata || {},
        tags: data.tags || [],
        importance: data.importance || 0.5,
        timestamp: data.created_at,
        embedding: data.embedding
      };

      logger.info('Memory stored successfully', LogContext.API, { 
        memoryId: memory.id, 
        contentLength: memory.content.length,
        hasEmbedding: !!embedding 
      });

      sendSuccess(res, memory, 201);

    } catch (error: any) {
      logger.error('Store memory error', LogContext.API, { error: error.message, stack: error.stack });
      sendError(res, 'INTERNAL_SERVER_ERROR' as ErrorCode, 'An unexpected error occurred while storing memory', 500, error.message);
    }
  });

  // Retrieve memories
  router.get('/', async (req: AuthenticatedRequest, res) => {
    try {
      const { memory_type, limit = 10, offset = 0, page = 1 } = req.query;
      
      // Calculate pagination
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));
      const offsetNum = (pageNum - 1) * limitNum;

      let query = supabase
        .from('memories')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offsetNum, offsetNum + limitNum - 1);

      if (memory_type) {
        query = query.eq('type', memory_type);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('Failed to retrieve memories', LogContext.API, { error: error.message });
        return sendError(res, 'MEMORY_STORAGE_ERROR' as ErrorCode, 'Failed to retrieve memories', 500, error.message);
      }

      // Transform to Memory type format
      const memories: Memory[] = (data || []).map(item => ({
        id: item.id,
        type: item.type || 'semantic',
        content: item.content,
        metadata: item.metadata || {},
        tags: item.tags || [],
        importance: item.importance || 0.5,
        timestamp: item.created_at,
        embedding: item.embedding
      }));

      // Update access tracking (async, don't wait)
      if (memories.length > 0) {
        const memoryIds = memories.map(m => m.id);
        // Fire and forget memory access tracking
        (async () => {
          try {
            await supabase.rpc('update_memory_access', {
              memory_ids: memoryIds,
              service_name: req.aiService?.service_name || 'unknown'
            });
          } catch (error: any) {
            logger.warn('Failed to update memory access tracking', LogContext.API, { error: error instanceof Error ? error.message : String(error) });
          }
        })();
      }

      const pagination = createPaginationMeta(pageNum, limitNum, count || 0);
      
      logger.info('Memories retrieved successfully', LogContext.API, { 
        count: memories.length, 
        totalCount: count,
        page: pageNum 
      });

      sendPaginatedSuccess(res, memories, pagination);

    } catch (error: any) {
      logger.error('Retrieve memories error', LogContext.API, { error: error.message, stack: error.stack });
      sendError(res, 'INTERNAL_SERVER_ERROR' as ErrorCode, 'An unexpected error occurred while retrieving memories', 500, error.message);
    }
  });

  // Search memories
  router.post('/search', validateMemorySearch, async (req: AuthenticatedRequest, res) => {
    const startTime = Date.now();
    try {
      const searchParams = req.validatedData;

      // Generate embedding for the query
      const { data: embedding } = await supabase.rpc('ai_generate_embedding', {
        content: searchParams.query
      });

      // Perform vector search
      const { data, error } = await supabase.rpc('search_memories', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: searchParams.limit,
        filter: searchParams.filters
      });

      if (error) throw error;

      res.json({
        success: true,
        data: {
          results: data,
          count: data.length,
          query: searchParams.query
        },
        metadata: {
          requestId: req.id,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          processingTime: Date.now() - startTime
        }
      });
    } catch (error: any) {
      logger.error('Search memories error:', LogContext.API, { error: error instanceof Error ? error.message : String(error) });
      res.status(400).json({
        success: false,
        error: {
          code: 'MEMORY_SEARCH_ERROR',
          message: error?.message || 'Unknown error',
          details: error
        },
        metadata: {
          requestId: req.id,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          processingTime: Date.now() - startTime
        }
      });
    }
  });

  // Update memory importance
  router.put('/:id/importance', async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { importance } = req.body;

      const { data, error } = await supabase
        .from('ai_memories')
        .update({ importance })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, memory: data });
    } catch (error: any) {
      logger.error('Update memory importance error:', LogContext.API, { error: error instanceof Error ? error.message : String(error) });
      res.status(400).json({ error: error?.message || 'Failed to update memory importance' });
    }
  });

  return router;
}
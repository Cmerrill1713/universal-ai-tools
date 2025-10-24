/**
 * Enhanced Supabase Router
 * API endpoints for file upload, processing, vector search, and realtime features
 */

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { enhancedSupabase } from '../services/enhanced-supabase-service';
import { LogContext, logger } from '../utils/enhanced-logger';
import { z } from 'zod';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// Validation schemas
const FileUploadSchema = z.object({
  bucket: z.string().default('uploads'),
  path: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const VectorSearchSchema = z.object({
  collection: z.string(),
  query: z.string(),
  limit: z.number().min(1).max(100).default(10),
  threshold: z.number().min(0).max(1).default(0.7),
  filter: z.record(z.any()).optional(),
});

const ProcessingOptionsSchema = z.object({
  extractText: z.boolean().default(true),
  generateEmbeddings: z.boolean().default(true),
  generateSummary: z.boolean().default(false),
  extractEntities: z.boolean().default(false),
  classifyContent: z.boolean().default(false),
});

// =====================================================
// FILE UPLOAD ENDPOINTS
// =====================================================

/**
 * Upload file to Supabase Storage
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const validation = FileUploadSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }

    const { bucket, metadata } = validation.data;
    const path = validation.data.path || `${Date.now()}-${req.file.originalname}`;

    const result = await enhancedSupabase.uploadFile({
      bucket,
      path,
      file: req.file.buffer,
      contentType: req.file.mimetype,
      metadata: {
        ...metadata,
        originalName: req.file.originalname,
        uploadedBy: req.user?.id,
      },
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('File upload failed:', LogContext.API, { error });
    res.status(500).json({ error: 'File upload failed' });
  }
});

/**
 * Upload multiple files
 */
router.post('/upload-multiple', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }

    const validation = FileUploadSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }

    const { bucket, metadata } = validation.data;

    const uploadPromises = files.map((file) =>
      enhancedSupabase.uploadFile({
        bucket,
        path: `${Date.now()}-${file.originalname}`,
        file: file.buffer,
        contentType: file.mimetype,
        metadata: {
          ...metadata,
          originalName: file.originalname,
          uploadedBy: req.user?.id,
        },
      })
    );

    const results = await Promise.all(uploadPromises);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error("Multiple file upload failed",', LogContext.API, { error});
    res.status(500).json({ error: "Multiple file upload failed" });
  }
});

/**
 * Get signed upload URL for direct browser uploads
 */
router.post('/upload-url', async (req: Request, res: Response) => {
  try {
    const { bucket, path, expiresIn = 3600 } = req.body;

    if (!bucket || !path) {
      return res.status(400).json({ error 'Bucket and path required' });
    }

    const result = await enhancedSupabase.createSignedUploadUrl(bucket, path, expiresIn);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(Failed to create upload URL:', LogContext.API, { error});
    res.status(500).json({ error 'Failed to create upload URL' });
  }
});

// =====================================================
// FILE PROCESSING ENDPOINTS
// =====================================================

/**
 * Process uploaded file with AI
 */
router.post('/process/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;

    const validation = ProcessingOptionsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await enhancedSupabase.processFileWithFullPipeline(fileId, validation.data);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(File processing failed:', LogContext.API, { error});
    res.status(500).json({ error 'File processing failed' });
  }
});

/**
 * Get file processing status
 */
router.get('/process/status/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const { data, error} = await enhancedSupabase.client
      .from('job_queue')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error|| !data) {
      return res.status(404).json({ error 'Job not found' });
    }

    res.json({
      success: true,
      data: {
        status: data.status,
        result: data.result,
        error data.error_message,
        startedAt: data.started_at,
        completedAt: data.completed_at,
      },
    });
  } catch (error) {
    logger.error(Failed to get job status:', LogContext.API, { error});
    res.status(500).json({ error 'Failed to get job status' });
  }
});

// =====================================================
// VECTOR SEARCH ENDPOINTS
// =====================================================

/**
 * Semantic search across documents
 */
router.post('/search/semantic', async (req: Request, res: Response) => {
  try {
    const validation = VectorSearchSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }

    const { collection, query, limit, threshold, filter } = validation.data;

    // Generate embedding for query
    const embedding = await generateEmbedding(query);

    const results = await enhancedSupabase.semanticSearch({
      collection,
      embedding,
      limit,
      threshold,
      filter,
    });

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error(Semantic search failed:', LogContext.DATABASE, { error});
    res.status(500).json({ error 'Semantic search failed' });
  }
});

/**
 * Hybrid search combining text and vector search
 */
router.post('/search/hybrid', async (req: Request, res: Response) => {
  try {
    const { collection, query, limit = 10, textWeight = 0.5, vectorWeight = 0.5 } = req.body;

    if (!collection || !query) {
      return res.status(400).json({ error 'Collection and query required' });
    }

    // Generate embedding for query
    const embedding = await generateEmbedding(query);

    const results = await enhancedSupabase.hybridSearch(collection, query, embedding, {
      limit,
      textWeight,
      vectorWeight,
    });

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error(Hybrid search failed:', LogContext.DATABASE, { error});
    res.status(500).json({ error 'Hybrid search failed' });
  }
});

// =====================================================
// MEMORY MANAGEMENT ENDPOINTS
// =====================================================

/**
 * Store memory with embedding
 */
router.post('/memory', async (req: Request, res: Response) => {
  try {
    const { type, _content metadata, importance = 0.5 } = req.body;

    if (!type || !_content {
      return res.status(400).json({ error 'Type and _contentrequired' });
    }

    // Generate embedding
    const embedding = await generateEmbedding(_content;

    const result = await enhancedSupabase.storeEmbedding('memory', _content embedding, {
      ...metadata,
      type,
      importance,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(Failed to store memory:', LogContext.MEMORY, { error});
    res.status(500).json({ error 'Failed to store memory' });
  }
});

/**
 * Search memories
 */
router.post('/memory/search', async (req: Request, res: Response) => {
  try {
    const { query, limit = 10, threshold = 0.7 } = req.body;

    if (!query) {
      return res.status(400).json({ error 'Query required' });
    }

    // Generate embedding
    const embedding = await generateEmbedding(query);

    const results = await enhancedSupabase.semanticSearch({
      collection: 'memory',
      embedding,
      limit,
      threshold,
      filter: { user_id: req.user?.id },
    });

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error(Memory search failed:', LogContext.MEMORY, { error});
    res.status(500).json({ error 'Memory search failed' });
  }
});

// =====================================================
// REALTIME ENDPOINTS
// =====================================================

/**
 * Subscribe to realtime updates (returns connection info)
 */
router.post('/realtime/subscribe', async (req: Request, res: Response) => {
  try {
    const { channel, events = ['*'] } = req.body;

    if (!channel) {
      return res.status(400).json({ error 'Channel required' });
    }

    // Generate access token for realtime connection
    const {
      data: { session },
    } = await enhancedSupabase.client.auth.getSession();

    res.json({
      success: true,
      data: {
        channel,
        events,
        accessToken: session?.access_token,
        realtimeUrl: `${process.env.SUPABASE_URL?.replace('https://', 'wss://')}/realtime/v1`,
      },
    });
  } catch (error) {
    logger.error(Failed to setup realtime subscription:', LogContext.WEBSOCKET, { error});
    res.status(500).json({ error 'Failed to setup realtime subscription' });
  }
});

/**
 * Broadcast message to channel
 */
router.post('/realtime/broadcast', async (req: Request, res: Response) => {
  try {
    const { channel, event, payload } = req.body;

    if (!channel || !event) {
      return res.status(400).json({ error 'Channel and event required' });
    }

    await enhancedSupabase.broadcastMessage(channel, event, {
      ...payload,
      broadcastedBy: req.user?.id,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Message broadcasted',
    });
  } catch (error) {
    logger.error(Failed to broadcast message:', LogContext.WEBSOCKET, { error});
    res.status(500).json({ error 'Failed to broadcast message' });
  }
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Generate embedding for text (placeholder - implement with your embedding service)
 */
async function generateEmbedding(text: string): Promise<number[]> {
  // This is a placeholder - integrate with your embedding service
  // For now, return a random embedding
  return Array.from({ length: 1536 }, () => Math.random());
}

// Error handling middleware
router.use((error Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(Router error', LogContext.ERROR, { error errormessage, stack: errorstack });
  res.status(500).json({
    error 'Internal server error,
    message: errormessage,
  });
});

export default router;
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from '../utils/logger';


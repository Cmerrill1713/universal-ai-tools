import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { authenticate } from '@/middleware/auth';
import { validateParams, validateQuery } from '@/middleware/validation';
import { zodValidate } from '@/middleware/zod-validate';
import { memoryService } from '@/services/memory-service';
import { robustMemoryService } from '@/services/robust-memory-service';
import { log, LogContext } from '@/utils/logger';
const router = Router();
router.get('/', authenticate, validateQuery(z.object({
    type: z.enum(['conversation', 'knowledge', 'context', 'preference']).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
})), async (req, res) => {
    try {
        const userId = req.user?.id || 'anonymous';
        const { type, limit = 50, offset = 0 } = req.query;
        const userMemories = await memoryService.list(userId, type || undefined, Number(limit), Number(offset));
        return res.json({
            success: true,
            data: {
                memories: userMemories.map((memory) => ({
                    id: memory.id,
                    content: memory.content,
                    type: memory.category || memory.type,
                    metadata: memory.metadata,
                })),
                pagination: {
                    total: userMemories.length,
                    limit: Number(limit),
                    offset: Number(offset),
                    hasMore: false,
                },
            },
            metadata: {
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] || uuidv4(),
            },
        });
    }
    catch (error) {
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
});
router.get('/:id', authenticate, validateParams(z.object({ id: z.string().uuid() })), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'anonymous';
        const memory = await memoryService.get(userId, id);
        if (!memory || memory.user_id !== userId) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'MEMORY_NOT_FOUND',
                    message: 'Memory not found',
                },
            });
        }
        return res.json({
            success: true,
            data: {
                id: memory.id,
                content: memory.content,
                type: memory.category,
                metadata: memory.metadata,
            },
            metadata: {
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] || uuidv4(),
            },
        });
    }
    catch (error) {
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
});
router.post('/', authenticate, zodValidate(z.object({
    content: z.string(),
    type: z.enum(['conversation', 'knowledge', 'context', 'preference']),
    metadata: z.record(z.any()).optional(),
    tags: z.array(z.string()).optional(),
    importance: z.number().min(0).max(1).optional(),
})), async (req, res) => {
    try {
        const userId = req.user?.id || 'anonymous';
        const { content, type, metadata = {}, tags = [], importance = 0.5 } = req.body;
        const id = await robustMemoryService.save({
            userId,
            content,
            type,
            metadata,
            tags,
            importance,
            source: 'memory_api',
        });
        log.info('Memory created', LogContext.API, { memoryId: id, type, userId });
        return res.json({
            success: true,
            data: {
                id,
                message: 'Memory created successfully',
            },
            metadata: {
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] || uuidv4(),
            },
        });
    }
    catch (error) {
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
});
router.put('/:id', authenticate, validateParams(z.object({ id: z.string().uuid() })), zodValidate(z
    .object({
    content: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    tags: z.array(z.string()).optional(),
    importance: z.number().min(0).max(1).optional(),
})
    .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
})), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'anonymous';
        const updates = req.body;
        const memory = await memoryService.get(userId, id);
        if (!memory) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'MEMORY_NOT_FOUND',
                    message: 'Memory not found',
                },
            });
        }
        const ok = await memoryService.update(userId, id, updates);
        return res.json({ success: ok, data: { id, message: 'Memory updated successfully' } });
    }
    catch (error) {
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
});
router.delete('/:id', authenticate, validateParams(z.object({ id: z.string().uuid() })), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'anonymous';
        const memory = await memoryService.get(userId, id);
        if (!memory) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'MEMORY_NOT_FOUND',
                    message: 'Memory not found',
                },
            });
        }
        const ok = await memoryService.remove(userId, id);
        return res.json({ success: ok, data: { message: 'Memory deleted successfully' } });
    }
    catch (error) {
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
});
router.post('/search', authenticate, zodValidate(z.object({
    query: z.string().min(1),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    threshold: z.number().min(0).max(1).optional(),
    types: z.array(z.enum(['conversation', 'knowledge', 'context', 'preference'])).optional(),
})), async (req, res) => {
    try {
        const userId = req.user?.id || 'anonymous';
        const { query, limit = 10, types = [] } = req.body;
        const typeFilter = types?.[0] || undefined;
        const rows = await memoryService.search(userId, query, typeFilter, Number(limit));
        return res.json({ success: true, data: { results: rows, query, resultsFound: rows.length } });
    }
    catch (error) {
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
});
router.post('/bulk', authenticate, zodValidate(z.object({
    memories: z
        .array(z.object({
        content: z.string(),
        type: z.enum(['conversation', 'knowledge', 'context', 'preference']),
        metadata: z.record(z.any()).optional(),
        tags: z.array(z.string()).optional(),
        importance: z.number().min(0).max(1).optional(),
    }))
        .min(1)
        .max(100),
})), async (req, res) => {
    try {
        const userId = req.user?.id || 'anonymous';
        const { memories: memoryData } = req.body;
        const createdMemories = [];
        for (const data of memoryData) {
            const memory = {
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
            await memoryService.save({
                userId,
                content: memory.content,
                type: memory.type,
                metadata: memory.metadata,
                source: 'memory_api_bulk',
                tags: memory.metadata.tags || [],
                importance: memory.metadata.importance || 0.5,
            });
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
    }
    catch (error) {
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
});
export default router;
//# sourceMappingURL=memory.js.map
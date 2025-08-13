import { Router } from 'express';
import { z } from 'zod';
import { knowledgeScraperService } from '../services/knowledge-scraper-service';
import { rerankingService } from '../services/reranking-service';
import { sendError, sendSuccess } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';
const router = Router();
const scrapeSchema = z.object({
    sources: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    limit: z.number().min(1).max(1000).optional(),
    updateExisting: z.boolean().optional(),
});
const searchSchema = z.object({
    query: z.string().min(1),
    sources: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
    useReranking: z.coerce.boolean().optional(),
    rerankingModel: z.string().optional(),
});
router.post('/scrape', async (req, res, next) => {
    try {
        const validation = scrapeSchema.safeParse(req.body);
        if (!validation.success) {
            return sendError(res, 'VALIDATION_ERROR', 'Invalid request', 400, validation.error.errors);
        }
        const { sources, categories, limit, updateExisting } = validation.data;
        log.info('🔍 Starting knowledge scraping', LogContext.API, {
            sources,
            categories,
            limit,
            updateExisting,
        });
        knowledgeScraperService
            .scrapeAllSources({
            categories,
            limit,
            updateExisting,
        })
            .catch((error) => {
            log.error('Knowledge scraping failed', LogContext.SERVICE, { error });
        });
        sendSuccess(res, {
            message: 'Knowledge scraping started',
            status: 'running',
        }, 202);
    }
    catch (error) {
        log.error('❌ Failed to start knowledge scraping', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.get('/search', async (req, res, next) => {
    try {
        const validation = searchSchema.safeParse(req.query);
        if (!validation.success) {
            return sendError(res, 'VALIDATION_ERROR', 'Invalid request', 400, validation.error.errors);
        }
        const { query, sources, categories, limit, useReranking, rerankingModel } = validation.data;
        const results = await knowledgeScraperService.searchKnowledge(query, {
            sources,
            categories,
            limit,
            useReranking,
            rerankingModel,
        });
        sendSuccess(res, {
            query,
            results,
            count: results.length,
            useReranking: useReranking || false,
            rerankingModel,
        });
    }
    catch (error) {
        log.error('❌ Knowledge search failed', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.get('/status', async (req, res, next) => {
    try {
        const status = await knowledgeScraperService.getScrapingStatus();
        sendSuccess(res, status);
    }
    catch (error) {
        log.error('❌ Failed to get knowledge status', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.get('/sources', async (req, res) => {
    try {
        const sources = [
            {
                name: 'MDN Web Docs',
                description: 'Comprehensive web development documentation',
                categories: ['javascript', 'css', 'html', 'web-api'],
                enabled: true,
            },
            {
                name: 'Stack Overflow',
                description: 'Programming Q&A with code examples',
                categories: ['general', 'debugging', 'best-practices'],
                enabled: true,
            },
            {
                name: 'Papers with Code',
                description: 'ML research papers with implementations',
                categories: ['ai-ml', 'deep-learning', 'nlp', 'computer-vision'],
                enabled: true,
            },
            {
                name: 'Hugging Face',
                description: 'AI model documentation and examples',
                categories: ['ai-models', 'transformers', 'datasets'],
                enabled: true,
            },
            {
                name: 'DevDocs',
                description: 'API documentation for multiple languages',
                categories: ['api-reference', 'language-docs'],
                enabled: true,
            },
            {
                name: 'arXiv',
                description: 'Latest research papers',
                categories: ['research', 'ai-ml', 'computer-science'],
                enabled: false,
            },
            {
                name: 'GitHub Trending',
                description: 'Popular repositories and code patterns',
                categories: ['open-source', 'code-examples'],
                enabled: false,
            },
            {
                name: 'npm Registry',
                description: 'JavaScript package documentation',
                categories: ['javascript', 'nodejs', 'packages'],
                enabled: false,
            },
        ];
        sendSuccess(res, { sources });
    }
    catch (error) {
        sendError(res, 'INTERNAL_ERROR', 'Failed to get sources', 500);
    }
});
router.get('/categories', async (req, res) => {
    try {
        const categories = [
            { name: 'web-development', description: 'Web technologies and APIs' },
            { name: 'ai-ml', description: 'AI and Machine Learning' },
            { name: 'programming-languages', description: 'Language references' },
            { name: 'frameworks', description: 'Software frameworks' },
            { name: 'databases', description: 'Database technologies' },
            { name: 'devops', description: 'DevOps tools and practices' },
            { name: 'security', description: 'Security best practices' },
            { name: 'algorithms', description: 'Algorithms and data structures' },
            { name: 'system-design', description: 'Architecture patterns' },
            { name: 'api-reference', description: 'API documentation' },
        ];
        sendSuccess(res, { categories });
    }
    catch (error) {
        sendError(res, 'INTERNAL_ERROR', 'Failed to get categories', 500);
    }
});
router.post('/sources/:sourceName/toggle', async (req, res) => {
    try {
        const { sourceName } = req.params;
        const { enabled } = req.body;
        sendSuccess(res, {
            source: sourceName,
            enabled,
            message: `Source ${enabled ? 'enabled' : 'disabled'}`,
        });
    }
    catch (error) {
        sendError(res, 'INTERNAL_ERROR', 'Failed to toggle source', 500);
    }
});
router.get('/health', async (req, res) => {
    try {
        const status = await knowledgeScraperService.getScrapingStatus();
        sendSuccess(res, {
            status: 'healthy',
            totalEntries: status.totalEntries,
            activeSources: status.sources.filter((s) => s.enabled).length,
            timestamp: Date.now(),
        });
    }
    catch (error) {
        sendError(res, 'INTERNAL_ERROR', 'Health check failed', 500);
    }
});
router.get('/reranking/stats', async (req, res, next) => {
    try {
        const stats = await rerankingService.getRerankingStats();
        sendSuccess(res, stats);
    }
    catch (error) {
        log.error('❌ Failed to get reranking stats', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        sendError(res, 'INTERNAL_ERROR', 'Failed to get reranking stats', 500);
    }
});
export default router;
//# sourceMappingURL=knowledge-scraper.js.map
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { RateLimiter } from 'limiter';
import { config } from '@/config/environment';
import { log, LogContext } from '../utils/logger';
import { rerankingService } from './reranking-service';
export class KnowledgeScraperService {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    sources = [
        {
            name: 'MDN Web Docs',
            type: 'web',
            url: 'https://developer.mozilla.org/en-US/docs/Web',
            rateLimit: 30,
            enabled: true,
            parser: this.parseMDN.bind(this),
        },
        {
            name: 'Stack Overflow',
            type: 'api',
            url: 'https://api.stackexchange.com/2.3/questions',
            rateLimit: 300,
            enabled: true,
            parser: this.parseStackOverflow.bind(this),
        },
        {
            name: 'Papers with Code',
            type: 'api',
            url: 'https://paperswithcode.com/api/v1/papers',
            rateLimit: 60,
            enabled: true,
            parser: this.parsePapersWithCode.bind(this),
        },
        {
            name: 'Hugging Face',
            type: 'api',
            url: 'https://huggingface.co/api/models',
            rateLimit: 100,
            enabled: true,
            parser: this.parseHuggingFace.bind(this),
        },
        {
            name: 'DevDocs',
            type: 'api',
            url: 'https://devdocs.io/docs.json',
            rateLimit: 60,
            enabled: true,
            parser: this.parseDevDocs.bind(this),
        },
    ];
    allowedHosts = new Set([
        'developer.mozilla.org',
        'api.stackexchange.com',
        'paperswithcode.com',
        'huggingface.co',
        'devdocs.io',
    ]);
    limiters = new Map();
    constructor() {
        this.sources.forEach((source) => {
            this.limiters.set(source.name, new RateLimiter({ tokensPerInterval: source.rateLimit, interval: 'minute' }));
        });
    }
    async scrapeAllSources(options = {}) {
        if (config.offlineMode || config.disableExternalCalls) {
            log.info('🌐 Offline mode: skipping external knowledge scraping', LogContext.SERVICE);
            return;
        }
        log.info('🔍 Starting knowledge scraping', LogContext.SERVICE);
        for (const source of this.sources) {
            if (!source.enabled)
                continue;
            try {
                await this.scrapeSource(source, options);
            }
            catch (error) {
                log.error(`Failed to scrape ${source.name}`, LogContext.SERVICE, { error });
            }
        }
        log.info('✅ Knowledge scraping completed', LogContext.SERVICE);
    }
    async scrapeSource(source, options = {}) {
        if (config.offlineMode || config.disableExternalCalls) {
            throw new Error('External scraping disabled in offline mode');
        }
        const limiter = this.limiters.get(source.name);
        log.info(`Scraping ${source.name}...`, LogContext.SERVICE);
        try {
            await limiter.removeTokens(1);
            let data;
            if (source.type === 'api') {
                const response = await axios.get(source.url, {
                    params: {
                        pagesize: options.limit || 100,
                        order: 'desc',
                        sort: 'votes',
                        tagged: options.categories?.join(';'),
                    },
                    headers: {
                        'User-Agent': 'Universal-AI-Tools/1.0',
                        Accept: 'application/json',
                    },
                    timeout: 15000,
                    maxRedirects: 3,
                    validateStatus: (status) => status >= 200 && status < 400,
                });
                data = response.data;
            }
            else if (source.type === 'web') {
                try {
                    const u = new URL(source.url);
                    if (!this.allowedHosts.has(u.hostname)) {
                        throw new Error('Host not allowed for scraping');
                    }
                }
                catch (e) {
                    throw new Error('Invalid URL for scraping');
                }
                const response = await axios.get(source.url, {
                    headers: {
                        'User-Agent': 'Universal-AI-Tools/1.0',
                        Accept: 'text/html',
                    },
                    timeout: 15000,
                    maxRedirects: 3,
                    validateStatus: (status) => status >= 200 && status < 400,
                });
                const html = String(response.data || '');
                const sanitized = html
                    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
                    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
                    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
                    .replace(/javascript:/gi, '');
                data = sanitized;
            }
            const entries = source.parser(data);
            await this.storeKnowledge(entries, options.updateExisting || false);
            log.info(`✅ Scraped ${entries.length} entries from ${source.name}`, LogContext.SERVICE);
        }
        catch (error) {
            throw new Error(`Scraping ${source.name} failed: ${error}`);
        }
    }
    async storeKnowledge(entries, updateExisting) {
        const batchSize = 100;
        for (let i = 0; i < entries.length; i += batchSize) {
            const batch = entries.slice(i, i + batchSize);
            for (const entry of batch) {
                if (!entry.embedding) {
                    entry.embedding = await this.generateEmbedding(entry.content);
                }
            }
            if (updateExisting) {
                await this.supabase.from('knowledge_base').upsert(batch, { onConflict: 'source,title' });
            }
            else {
                await this.supabase.from('knowledge_base').insert(batch);
            }
        }
    }
    async generateEmbedding(content) {
        const mockEmbedding = Array(1536)
            .fill(0)
            .map(() => Math.random());
        return mockEmbedding;
    }
    parseMDN(html) {
        const $ = cheerio.load(html);
        const entries = [];
        $('article').each((_, element) => {
            const title = $(element).find('h1').text().trim();
            const content = $(element).find('.section-content').text().trim();
            const category = 'web-development';
            if (title && content) {
                entries.push({
                    source: 'MDN',
                    category,
                    title,
                    content,
                    metadata: {
                        url: $(element).find('link[rel="canonical"]').attr('href'),
                        lastModified: new Date().toISOString(),
                    },
                    timestamp: new Date(),
                });
            }
        });
        return entries;
    }
    parseStackOverflow(data) {
        return (data.items || []).map((item) => ({
            source: 'StackOverflow',
            category: item.tags?.[0] || 'general',
            title: item.title,
            content: `Q: ${item.title}\n\nA: ${item.accepted_answer?.body || 'No accepted answer'}`,
            metadata: {
                questionId: item.question_id,
                score: item.score,
                viewCount: item.view_count,
                tags: item.tags,
                link: item.link,
            },
            timestamp: new Date(),
        }));
    }
    parsePapersWithCode(data) {
        return (data.results || []).map((paper) => ({
            source: 'PapersWithCode',
            category: 'ai-ml',
            title: paper.title,
            content: paper.abstract || '',
            metadata: {
                paperId: paper.id,
                arxivId: paper.arxiv_id,
                urlPdf: paper.url_pdf,
                publishedDate: paper.published,
                authors: paper.authors,
            },
            timestamp: new Date(),
        }));
    }
    parseHuggingFace(data) {
        return (data || []).slice(0, 100).map((model) => ({
            source: 'HuggingFace',
            category: 'ai-models',
            title: model.modelId,
            content: `Model: ${model.modelId}\nTask: ${model.pipeline_tag || 'unknown'}\n\n${model.description || 'No description'}`,
            metadata: {
                modelId: model.modelId,
                task: model.pipeline_tag,
                downloads: model.downloads,
                likes: model.likes,
                tags: model.tags,
            },
            timestamp: new Date(),
        }));
    }
    parseDevDocs(data) {
        return (data || []).map((doc) => ({
            source: 'DevDocs',
            category: 'api-reference',
            title: `${doc.name} ${doc.version || ''}`.trim(),
            content: `${doc.name} documentation - ${doc.slug}`,
            metadata: {
                slug: doc.slug,
                type: doc.type,
                version: doc.version,
                mtime: doc.mtime,
            },
            timestamp: new Date(),
        }));
    }
    async searchKnowledge(query, options = {}) {
        const embedding = await this.generateEmbedding(query);
        const searchLimit = options.useReranking ? (options.limit || 10) * 10 : options.limit || 10;
        let queryBuilder = this.supabase.rpc('search_knowledge', {
            query_embedding: embedding,
            match_count: searchLimit,
        });
        if (options.sources?.length) {
            queryBuilder = queryBuilder.in('source', options.sources);
        }
        if (options.categories?.length) {
            queryBuilder = queryBuilder.in('category', options.categories);
        }
        const { data, error } = await queryBuilder;
        if (error) {
            throw new Error(`Knowledge search failed: ${error.message}`);
        }
        const results = data || [];
        if (options.useReranking && results.length > 0) {
            log.info('🔄 Applying reranking to search results', LogContext.SERVICE, {
                initialCount: results.length,
                targetCount: options.limit || 10,
            });
            try {
                const candidates = results.map((result) => ({
                    id: result.id,
                    content: `${result.title}\n\n${result.content}`,
                    metadata: result.metadata,
                    biEncoderScore: result.similarity || 0,
                }));
                const rerankedResults = await rerankingService.rerank(query, candidates, {
                    topK: options.limit || 10,
                    model: options.rerankingModel,
                });
                return rerankedResults.map((reranked) => {
                    const original = results.find((r) => r.id === reranked.id);
                    return {
                        ...original,
                        similarity: reranked.finalScore,
                        reranking_score: reranked.crossEncoderScore,
                    };
                });
            }
            catch (rerankError) {
                log.warn('⚠️ Reranking failed, returning original results', LogContext.SERVICE, {
                    error: rerankError,
                });
                return results.slice(0, options.limit || 10);
            }
        }
        return results;
    }
    async getScrapingStatus() {
        try {
            const { data: entries, error: entriesError } = await this.supabase
                .from('knowledge_base')
                .select('source')
                .not('source', 'is', null);
            if (entriesError) {
                log.warn('Failed to get knowledge base entries', LogContext.DATABASE, {
                    error: entriesError,
                });
            }
            const sourceCounts = new Map();
            if (entries) {
                entries.forEach((entry) => {
                    const source = entry.source || 'unknown';
                    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
                });
            }
            const { count: totalEntries } = await this.supabase
                .from('knowledge_base')
                .select('*', { count: 'exact', head: true });
            return {
                sources: this.sources.map((source) => ({
                    name: source.name,
                    enabled: source.enabled,
                    entryCount: sourceCounts.get(source.name) || 0,
                })),
                totalEntries: totalEntries || 0,
            };
        }
        catch (error) {
            log.error('Failed to get scraping status', LogContext.SERVICE, { error });
            return {
                sources: this.sources.map((source) => ({
                    name: source.name,
                    enabled: source.enabled,
                    entryCount: 0,
                })),
                totalEntries: 0,
            };
        }
    }
}
export const knowledgeScraperService = new KnowledgeScraperService();
//# sourceMappingURL=knowledge-scraper-service.js.map
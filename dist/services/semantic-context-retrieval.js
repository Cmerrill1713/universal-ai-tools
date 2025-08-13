import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';
import { log, LogContext } from '../utils/logger';
import { contextStorageService } from './context-storage-service';
export class SemanticContextRetrievalService {
    supabase;
    embeddingCache = new Map();
    EMBEDDING_CACHE_TTL = 30 * 60 * 1000;
    DEFAULT_EMBEDDING_MODEL = 'all-minilm:latest';
    similarityThreshold;
    MAX_CACHE_SIZE = 1000;
    SCORING_WEIGHTS = {
        semantic: 0.4,
        temporal: 0.2,
        contextual: 0.25,
        importance: 0.15,
    };
    constructor() {
        this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
        const envMin = Number(process.env.CTX_MIN_SIMILARITY || '0.25');
        this.similarityThreshold = Number.isFinite(envMin) ? envMin : 0.25;
        log.info('🔍 Semantic Context Retrieval Service initialized', LogContext.CONTEXT_INJECTION, {
            embeddingModel: this.DEFAULT_EMBEDDING_MODEL,
            similarityThreshold: this.similarityThreshold,
            cacheSize: this.MAX_CACHE_SIZE,
        });
    }
    async semanticSearch(options) {
        const startTime = Date.now();
        try {
            log.info('🔍 Starting semantic context search', LogContext.CONTEXT_INJECTION, {
                query: options.query.substring(0, 100),
                userId: options.userId,
                maxResults: options.maxResults || 20,
                contextTypes: options.contextTypes?.map((ct) => ct.type) || 'all',
            });
            const embeddingStart = Date.now();
            const queryEmbedding = await this.getQueryEmbedding(options.query);
            const embeddingTime = Date.now() - embeddingStart;
            if (!queryEmbedding) {
                throw new Error('Failed to generate query embedding');
            }
            const dbStart = Date.now();
            const [storedContextResults, conversationResults, knowledgeResults, summaryResults] = await Promise.all([
                this.searchStoredContext(options, queryEmbedding),
                this.searchConversationHistory(options, queryEmbedding),
                this.searchKnowledgeBase(options, queryEmbedding),
                this.searchContextSummaries(options, queryEmbedding),
            ]);
            const dbTime = Date.now() - dbStart;
            const allResults = [
                ...storedContextResults,
                ...conversationResults,
                ...knowledgeResults,
                ...summaryResults,
            ];
            const minScore = options.minRelevanceScore || this.similarityThreshold;
            const filteredResults = allResults.filter((r) => r.combinedScore >= minScore);
            const maxResults = options.maxResults || 20;
            const prelimTop = filteredResults
                .sort((a, b) => b.combinedScore - a.combinedScore)
                .slice(0, Math.max(maxResults * 2, 20));
            let topResults = prelimTop;
            try {
                const hasHf = !!process.env.HUGGINGFACE_API_KEY;
                const hasOpenAI = !!process.env.OPENAI_API_KEY;
                if (prelimTop.length > 0 && (hasHf || hasOpenAI)) {
                    const { rerankingService } = await import('./reranking-service');
                    const reranked = await rerankingService.rerank(options.query, prelimTop.map((r) => ({
                        id: r.id,
                        content: r.content,
                        metadata: r.metadata,
                        biEncoderScore: r.combinedScore,
                    })), { topK: maxResults, threshold: options.minRelevanceScore || this.similarityThreshold });
                    const byId = new Map(prelimTop.map((r) => [r.id, r]));
                    topResults = reranked
                        .map((rr) => byId.get(rr.id))
                        .filter((x) => !!x);
                }
            }
            catch (e) {
                log.warn('⚠️ Smart rerank unavailable, using bi-encoder ranking', LogContext.CONTEXT_INJECTION, {
                    error: e instanceof Error ? e.message : String(e),
                });
                topResults = prelimTop.slice(0, maxResults);
            }
            const finalResults = options.fuseSimilarResults
                ? this.fuseSimilarResults(topResults, 0.85)
                : topResults;
            const clusters = this.clusterResults(finalResults);
            const totalTime = Date.now() - startTime;
            const metrics = {
                searchTimeMs: totalTime,
                totalResults: allResults.length,
                clusteredResults: finalResults.length,
                averageRelevance: finalResults.length > 0
                    ? finalResults.reduce((sum, r) => sum + r.combinedScore, 0) / finalResults.length
                    : 0,
                topicCoverage: clusters.clusters.length,
                embeddingComputeTime: embeddingTime,
                databaseQueryTime: dbTime,
            };
            log.info('✅ Semantic search completed', LogContext.CONTEXT_INJECTION, {
                totalResults: finalResults.length,
                clustersFound: clusters.clusters.length,
                searchTimeMs: totalTime,
                averageRelevance: metrics.averageRelevance.toFixed(3),
            });
            return {
                results: finalResults,
                clusters,
                metrics,
            };
        }
        catch (error) {
            log.error('❌ Semantic search failed', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
                query: options.query.substring(0, 50),
                userId: options.userId,
            });
            return this.fallbackTextSearch(options);
        }
    }
    async searchStoredContext(options, queryEmbedding) {
        try {
            try {
                const { data, error } = await this.supabase.rpc('search_context_storage_by_embedding', {
                    query_embedding: queryEmbedding,
                    in_user_id: options.userId,
                    in_category: null,
                    in_limit: 100,
                });
                if (!error && Array.isArray(data) && data.length > 0) {
                    const annResults = [];
                    for (const row of data) {
                        if (options.timeWindow && row.created_at) {
                            const t = new Date(row.created_at).getTime();
                            const cutoff = Date.now() - options.timeWindow * 60 * 60 * 1000;
                            if (t < cutoff)
                                continue;
                        }
                        const content = row.content || '';
                        if (content.length < 10)
                            continue;
                        const semanticScore = typeof row.similarity === 'number'
                            ? row.similarity
                            : Math.max(0, Math.min(1, row.score || 0));
                        if (semanticScore < this.similarityThreshold)
                            continue;
                        const temporalScore = this.calculateTemporalScore(new Date(row.created_at || Date.now()));
                        const contextScore = this.calculateContextualScore(row, options);
                        const importanceScore = this.calculateImportanceScore(content, row.category || 'conversation');
                        const combinedScore = this.combineScores({
                            semantic: semanticScore,
                            temporal: temporalScore,
                            contextual: contextScore,
                            importance: importanceScore,
                        });
                        annResults.push({
                            id: row.id,
                            content,
                            contentType: row.category || 'conversation',
                            source: row.source || 'context_storage',
                            relevanceScore: semanticScore,
                            semanticScore,
                            temporalScore,
                            contextScore,
                            combinedScore,
                            embedding: undefined,
                            metadata: {
                                timestamp: new Date(row.created_at || Date.now()),
                                userId: row.user_id || options.userId,
                                projectPath: row.project_path || options.projectPath,
                                tags: this.extractTags(content),
                                topics: this.extractTopics(content),
                                wordCount: content.split(' ').length,
                                tokenCount: Math.ceil(content.length / 4),
                            },
                        });
                    }
                    if (annResults.length > 0) {
                        log.info('🧠 Using ANN memory retrieval (Supabase)', LogContext.CONTEXT_INJECTION, {
                            results: annResults.length,
                        });
                        return annResults;
                    }
                }
            }
            catch (e) {
                log.warn('⚠️ ANN RPC unavailable, falling back to client-side search', LogContext.CONTEXT_INJECTION, {
                    error: e instanceof Error ? e.message : String(e),
                });
            }
            const storedContext = await contextStorageService.getContext(options.userId, undefined, options.projectPath, 50);
            const results = [];
            for (const context of storedContext) {
                if (options.timeWindow) {
                    const contextTime = new Date(context.created_at).getTime();
                    const cutoff = Date.now() - options.timeWindow * 60 * 60 * 1000;
                    if (contextTime < cutoff)
                        continue;
                }
                const contextEmbedding = await this.getContentEmbedding(context.content);
                if (!contextEmbedding)
                    continue;
                const semanticScore = this.cosineSimilarity(queryEmbedding, contextEmbedding);
                if (semanticScore < this.similarityThreshold)
                    continue;
                const temporalScore = this.calculateTemporalScore(new Date(context.created_at));
                const contextScore = this.calculateContextualScore(context, options);
                const importanceScore = this.calculateImportanceScore(context.content, context.category);
                const combinedScore = this.combineScores({
                    semantic: semanticScore,
                    temporal: temporalScore,
                    contextual: contextScore,
                    importance: importanceScore,
                });
                results.push({
                    id: context.id,
                    content: context.content,
                    contentType: context.category,
                    source: context.source,
                    relevanceScore: semanticScore,
                    semanticScore,
                    temporalScore,
                    contextScore,
                    combinedScore,
                    embedding: options.includeEmbeddings ? contextEmbedding : undefined,
                    metadata: {
                        timestamp: new Date(context.created_at),
                        userId: context.userId,
                        projectPath: context.projectPath || undefined,
                        tags: this.extractTags(context.content),
                        topics: this.extractTopics(context.content),
                        wordCount: context.content.split(' ').length,
                        tokenCount: Math.ceil(context.content.length / 4),
                    },
                });
            }
            return results;
        }
        catch (error) {
            log.error('❌ Stored context search failed', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
    async searchConversationHistory(options, queryEmbedding) {
        try {
            const stored = await contextStorageService.getContext(options.userId, 'conversation', options.projectPath, 100);
            const results = [];
            for (const conv of stored || []) {
                if (options.timeWindow) {
                    const convTime = new Date(conv.created_at).getTime();
                    const cutoff = Date.now() - options.timeWindow * 60 * 60 * 1000;
                    if (convTime < cutoff)
                        continue;
                }
                const content = conv.content || '';
                if (content.length < 10)
                    continue;
                const contentEmbedding = await this.getContentEmbedding(content);
                if (!contentEmbedding)
                    continue;
                const semanticScore = this.cosineSimilarity(queryEmbedding, contentEmbedding);
                if (semanticScore < this.similarityThreshold)
                    continue;
                const temporalScore = this.calculateTemporalScore(new Date(conv.created_at));
                const contextScore = this.calculateContextualScore(conv, options);
                const importanceScore = this.calculateImportanceScore(content, 'conversation');
                const combinedScore = this.combineScores({
                    semantic: semanticScore,
                    temporal: temporalScore,
                    contextual: contextScore,
                    importance: importanceScore,
                });
                results.push({
                    id: conv.id,
                    content,
                    contentType: 'conversation',
                    source: conv.source,
                    relevanceScore: semanticScore,
                    semanticScore,
                    temporalScore,
                    contextScore,
                    combinedScore,
                    embedding: options.includeEmbeddings ? contentEmbedding : undefined,
                    metadata: {
                        timestamp: new Date(conv.created_at),
                        userId: conv.userId,
                        projectPath: conv.projectPath || undefined,
                        tags: this.extractTags(content),
                        topics: this.extractTopics(content),
                        wordCount: content.split(' ').length,
                        tokenCount: Math.ceil(content.length / 4),
                    },
                });
            }
            return results;
        }
        catch (error) {
            log.error('❌ Conversation search failed', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
    async searchKnowledgeBase(options, queryEmbedding) {
        try {
            const { data: knowledge, error } = await this.supabase
                .from('knowledge_sources')
                .select('*')
                .textSearch('content', options.query, { type: 'websearch' })
                .limit(30);
            if (error) {
                return [];
            }
            const results = [];
            for (const item of knowledge || []) {
                const content = item.content || '';
                if (content.length < 20)
                    continue;
                const contentEmbedding = await this.getContentEmbedding(content);
                if (!contentEmbedding)
                    continue;
                const semanticScore = this.cosineSimilarity(queryEmbedding, contentEmbedding);
                if (semanticScore < this.similarityThreshold)
                    continue;
                const temporalScore = this.calculateTemporalScore(new Date(item.created_at || Date.now()));
                const contextScore = 0.7;
                const importanceScore = this.calculateImportanceScore(content, 'knowledge');
                const combinedScore = this.combineScores({
                    semantic: semanticScore,
                    temporal: temporalScore,
                    contextual: contextScore,
                    importance: importanceScore,
                });
                results.push({
                    id: item.id,
                    content,
                    contentType: 'knowledge',
                    source: item.source || 'knowledge_base',
                    relevanceScore: semanticScore,
                    semanticScore,
                    temporalScore,
                    contextScore,
                    combinedScore,
                    embedding: options.includeEmbeddings ? contentEmbedding : undefined,
                    metadata: {
                        timestamp: new Date(item.created_at || Date.now()),
                        userId: options.userId,
                        tags: item.tags || this.extractTags(content),
                        topics: this.extractTopics(content),
                        wordCount: content.split(' ').length,
                        tokenCount: Math.ceil(content.length / 4),
                    },
                });
            }
            return results;
        }
        catch (error) {
            log.error('❌ Knowledge base search failed', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
    async searchContextSummaries(options, queryEmbedding) {
        try {
            const summaries = await contextStorageService.searchContext(options.userId, options.query, 'conversation', 20);
            const results = [];
            for (const summary of summaries) {
                if (!summary.metadata?.summaryType)
                    continue;
                const { content } = summary;
                const contentEmbedding = await this.getContentEmbedding(content);
                if (!contentEmbedding)
                    continue;
                const semanticScore = this.cosineSimilarity(queryEmbedding, contentEmbedding);
                if (semanticScore < this.similarityThreshold)
                    continue;
                const temporalScore = this.calculateTemporalScore(new Date(summary.created_at));
                const contextScore = this.calculateContextualScore(summary, options);
                const importanceScore = 0.6;
                const combinedScore = this.combineScores({
                    semantic: semanticScore,
                    temporal: temporalScore,
                    contextual: contextScore,
                    importance: importanceScore,
                });
                results.push({
                    id: summary.id,
                    content,
                    contentType: 'summary',
                    source: summary.source,
                    relevanceScore: semanticScore,
                    semanticScore,
                    temporalScore,
                    contextScore,
                    combinedScore,
                    embedding: options.includeEmbeddings ? contentEmbedding : undefined,
                    metadata: {
                        timestamp: new Date(summary.created_at),
                        userId: summary.userId,
                        projectPath: summary.projectPath || undefined,
                        tags: this.extractTags(content),
                        topics: summary.metadata?.keyPoints || this.extractTopics(content),
                        wordCount: content.split(' ').length,
                        tokenCount: Math.ceil(content.length / 4),
                    },
                });
            }
            return results;
        }
        catch (error) {
            log.error('❌ Summary search failed', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
    async getQueryEmbedding(query) {
        return this.getContentEmbedding(query);
    }
    async getContentEmbedding(content) {
        try {
            const cacheKey = this.createCacheKey(content);
            const cached = this.embeddingCache.get(cacheKey);
            if (cached && cached.expiry > Date.now()) {
                return cached.embedding;
            }
            const embedding = await this.generateEmbedding(content);
            if (!embedding)
                return null;
            this.cacheEmbedding(cacheKey, embedding);
            return embedding;
        }
        catch (error) {
            log.error('❌ Embedding generation failed', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
                contentLength: content.length,
            });
            return null;
        }
    }
    async generateEmbedding(content) {
        try {
            const truncatedContent = content.length > 2000 ? `${content.substring(0, 2000)}...` : content;
            if (!globalThis.fetch) {
                return this.generateFallbackEmbedding(content);
            }
            const response = await globalThis.fetch('http://localhost:11434/api/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.DEFAULT_EMBEDDING_MODEL,
                    prompt: truncatedContent,
                }),
            });
            if (!response.ok) {
                throw new Error(`Embedding API failed: ${response.status}`);
            }
            const data = await response.json();
            return data.embedding || null;
        }
        catch (error) {
            log.warn('⚠️ Embedding generation via Ollama failed, using fallback', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
            });
            return this.generateFallbackEmbedding(content);
        }
    }
    generateFallbackEmbedding(content) {
        const embedding = new Array(384).fill(0);
        const words = content.toLowerCase().split(/\s+/);
        for (let i = 0; i < words.length && i < 100; i++) {
            const word = words[i];
            if (!word)
                continue;
            const hash = this.simpleHash(word);
            const index = Math.abs(hash) % embedding.length;
            embedding[index] += 1 / (i + 1);
        }
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return magnitude > 0 ? embedding.map((val) => val / magnitude) : embedding;
    }
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return hash;
    }
    cosineSimilarity(a, b) {
        if (a.length !== b.length) {
            log.warn('⚠️ Embedding dimension mismatch', LogContext.CONTEXT_INJECTION, {
                aLength: a.length,
                bLength: b.length,
            });
            return 0;
        }
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            const aVal = a[i] || 0;
            const bVal = b[i] || 0;
            dotProduct += aVal * bVal;
            normA += aVal * aVal;
            normB += bVal * bVal;
        }
        if (normA === 0 || normB === 0)
            return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
    calculateTemporalScore(timestamp) {
        const now = Date.now();
        const age = now - timestamp.getTime();
        const dayMs = 24 * 60 * 60 * 1000;
        if (age < dayMs)
            return 1.0;
        if (age < 7 * dayMs)
            return 0.8;
        if (age < 30 * dayMs)
            return 0.6;
        if (age < 90 * dayMs)
            return 0.4;
        return 0.2;
    }
    calculateContextualScore(context, options) {
        let score = 0.5;
        if (options.projectPath && context.projectPath === options.projectPath) {
            score += 0.3;
        }
        if (options.sessionId && context.metadata?.sessionId === options.sessionId) {
            score += 0.2;
        }
        return Math.min(1.0, score);
    }
    calculateContextualScoreFromMetadata(metadata, options) {
        let score = 0.5;
        if (options.sessionId && metadata.sessionId === options.sessionId) {
            score += 0.3;
        }
        return Math.min(1.0, score);
    }
    calculateImportanceScore(content, type) {
        let score = 0.5;
        const typeScores = {
            conversation: 0.7,
            code: 0.8,
            error: 0.9,
            summary: 0.6,
            knowledge: 0.8,
            project_info: 0.75,
            verified_answer: 0.9,
        };
        score = typeScores[type] || 0.5;
        const lowerContent = content.toLowerCase();
        if (lowerContent.includes('?') || lowerContent.match(/^(what|how|why|when|where)/)) {
            score += 0.1;
        }
        if (lowerContent.includes('error') || lowerContent.includes('failed')) {
            score += 0.2;
        }
        if (lowerContent.includes('```') || lowerContent.includes('function')) {
            score += 0.1;
        }
        return Math.min(1.0, score);
    }
    combineScores(scores) {
        return (scores.semantic * this.SCORING_WEIGHTS.semantic +
            scores.temporal * this.SCORING_WEIGHTS.temporal +
            scores.contextual * this.SCORING_WEIGHTS.contextual +
            scores.importance * this.SCORING_WEIGHTS.importance);
    }
    clusterResults(results) {
        if (results.length === 0) {
            return { clusters: [], outliers: [], totalResults: 0 };
        }
        const clusters = [];
        const outliers = [];
        const processed = new Set();
        for (const result of results) {
            if (processed.has(result.id))
                continue;
            const cluster = {
                id: `cluster_${clusters.length}`,
                topic: this.extractPrimaryTopic(result),
                results: [result],
                averageScore: result.combinedScore,
                summary: `${result.content.substring(0, 200)}...`,
            };
            processed.add(result.id);
            for (const other of results) {
                if (processed.has(other.id) || other.id === result.id)
                    continue;
                const topicSimilarity = this.calculateTopicSimilarity(result, other);
                if (topicSimilarity > 0.6) {
                    cluster.results.push(other);
                    processed.add(other.id);
                }
            }
            if (cluster.results.length > 1) {
                cluster.averageScore =
                    cluster.results.reduce((sum, r) => sum + r.combinedScore, 0) / cluster.results.length;
                cluster.summary = this.createClusterSummary(cluster.results);
            }
            if (cluster.results.length >= 2) {
                clusters.push(cluster);
            }
            else {
                outliers.push(result);
            }
        }
        return {
            clusters: clusters.sort((a, b) => b.averageScore - a.averageScore),
            outliers: outliers.sort((a, b) => b.combinedScore - a.combinedScore),
            totalResults: results.length,
        };
    }
    fuseSimilarResults(results, threshold = 0.85) {
        const fused = [];
        const processed = new Set();
        for (const result of results) {
            if (processed.has(result.id))
                continue;
            const similar = results.filter((r) => !processed.has(r.id) &&
                r.id !== result.id &&
                this.calculateContentSimilarity(result.content, r.content) > threshold);
            if (similar.length > 0) {
                const allResults = [result, ...similar];
                const fusedResult = {
                    ...result,
                    id: `fused_${result.id}`,
                    content: this.fuseContent(allResults),
                    combinedScore: allResults.reduce((sum, r) => sum + r.combinedScore, 0) / allResults.length,
                    metadata: {
                        ...result.metadata,
                        tags: [...new Set(allResults.flatMap((r) => r.metadata.tags))],
                        topics: [...new Set(allResults.flatMap((r) => r.metadata.topics))],
                    },
                };
                fused.push(fusedResult);
                allResults.forEach((r) => processed.add(r.id));
            }
            else {
                fused.push(result);
                processed.add(result.id);
            }
        }
        return fused;
    }
    calculateTopicSimilarity(a, b) {
        const aTopics = new Set(a.metadata.topics);
        const bTopics = new Set(b.metadata.topics);
        const intersection = new Set([...aTopics].filter((t) => bTopics.has(t)));
        const union = new Set([...aTopics, ...bTopics]);
        return union.size > 0 ? intersection.size / union.size : 0;
    }
    calculateContentSimilarity(a, b) {
        const wordsA = new Set(a.toLowerCase().split(/\s+/));
        const wordsB = new Set(b.toLowerCase().split(/\s+/));
        const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
        const union = new Set([...wordsA, ...wordsB]);
        return union.size > 0 ? intersection.size / union.size : 0;
    }
    extractPrimaryTopic(result) {
        if (result.metadata.topics.length > 0) {
            return result.metadata.topics[0] || 'general';
        }
        const topics = this.extractTopics(result.content);
        return topics[0] || 'general';
    }
    createClusterSummary(results) {
        const allTopics = [...new Set(results.flatMap((r) => r.metadata.topics))];
        const primaryTopic = allTopics[0] || 'discussion';
        return (`Cluster of ${results.length} related items about ${primaryTopic}. ` +
            `Average relevance: ${(results.reduce((sum, r) => sum + r.combinedScore, 0) / results.length).toFixed(2)}`);
    }
    fuseContent(results) {
        const primary = results[0];
        const supporting = results.slice(1);
        let fusedContent = primary?.content || '';
        if (supporting.length > 0) {
            fusedContent += `\n\nRelated context:\n${supporting
                .map((r) => `${r.content.substring(0, 200)}...`)
                .join('\n')}`;
        }
        return fusedContent;
    }
    extractTags(content) {
        const tags = [];
        const lowerContent = content.toLowerCase();
        const techTerms = [
            'typescript',
            'javascript',
            'python',
            'react',
            'node',
            'api',
            'database',
            'server',
            'frontend',
            'backend',
            'error',
            'bug',
            'feature',
            'test',
            'deployment',
        ];
        techTerms.forEach((term) => {
            if (lowerContent.includes(term)) {
                tags.push(term);
            }
        });
        return tags.slice(0, 5);
    }
    extractTopics(content) {
        const topics = [];
        const lowerContent = content.toLowerCase();
        const topicPatterns = [
            { pattern: /(authentication|auth|login|signin)/g, topic: 'authentication' },
            { pattern: /(database|db|query|sql|supabase)/g, topic: 'database' },
            { pattern: /(api|endpoint|route|request|response)/g, topic: 'api' },
            { pattern: /(error|exception|bug|issue|problem)/g, topic: 'errors' },
            { pattern: /(test|testing|spec|unit|integration)/g, topic: 'testing' },
            { pattern: /(frontend|ui|interface|component)/g, topic: 'frontend' },
            { pattern: /(backend|server|service|middleware)/g, topic: 'backend' },
            { pattern: /(deploy|deployment|production|build)/g, topic: 'deployment' },
        ];
        topicPatterns.forEach(({ pattern, topic }) => {
            if (pattern.test(lowerContent)) {
                topics.push(topic);
            }
        });
        return topics.length > 0 ? topics : ['general'];
    }
    createCacheKey(content) {
        const prefix = content.substring(0, 100);
        return `${prefix.replace(/\s+/g, '_')}_${content.length}`;
    }
    cacheEmbedding(key, embedding) {
        if (this.embeddingCache.size >= this.MAX_CACHE_SIZE) {
            const oldestKey = this.embeddingCache.keys().next().value;
            if (oldestKey) {
                this.embeddingCache.delete(oldestKey);
            }
        }
        this.embeddingCache.set(key, {
            embedding,
            expiry: Date.now() + this.EMBEDDING_CACHE_TTL,
        });
    }
    async fallbackTextSearch(options) {
        try {
            log.info('🔄 Falling back to text search', LogContext.CONTEXT_INJECTION, {
                query: options.query.substring(0, 50),
            });
            const startTime = Date.now();
            const textResults = await contextStorageService.searchContext(options.userId, options.query, undefined, options.maxResults || 20);
            const results = textResults.map((result) => ({
                id: result.id,
                content: result.content,
                contentType: result.category,
                source: result.source,
                relevanceScore: 0.5,
                semanticScore: 0.5,
                temporalScore: this.calculateTemporalScore(new Date(result.created_at)),
                contextScore: this.calculateContextualScore(result, options),
                combinedScore: 0.5,
                metadata: {
                    timestamp: new Date(result.created_at),
                    userId: result.userId,
                    projectPath: result.projectPath || undefined,
                    tags: this.extractTags(result.content),
                    topics: this.extractTopics(result.content),
                    wordCount: result.content.split(' ').length,
                    tokenCount: Math.ceil(result.content.length / 4),
                },
            }));
            const clusters = this.clusterResults(results);
            const totalTime = Date.now() - startTime;
            return {
                results,
                clusters,
                metrics: {
                    searchTimeMs: totalTime,
                    totalResults: results.length,
                    clusteredResults: results.length,
                    averageRelevance: 0.5,
                    topicCoverage: clusters.clusters.length,
                    embeddingComputeTime: 0,
                    databaseQueryTime: totalTime,
                },
            };
        }
        catch (error) {
            log.error('❌ Fallback text search failed', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                results: [],
                clusters: { clusters: [], outliers: [], totalResults: 0 },
                metrics: {
                    searchTimeMs: 0,
                    totalResults: 0,
                    clusteredResults: 0,
                    averageRelevance: 0,
                    topicCoverage: 0,
                    embeddingComputeTime: 0,
                    databaseQueryTime: 0,
                },
            };
        }
    }
    clearCache() {
        this.embeddingCache.clear();
        log.info('🧹 Semantic retrieval cache cleared', LogContext.CONTEXT_INJECTION);
    }
    getCacheStats() {
        const { size } = this.embeddingCache;
        const memoryUsage = size * 1.5;
        return {
            size,
            hitRate: 0,
            memoryUsage,
        };
    }
}
export const semanticContextRetrievalService = new SemanticContextRetrievalService();
export default semanticContextRetrievalService;
//# sourceMappingURL=semantic-context-retrieval.js.map
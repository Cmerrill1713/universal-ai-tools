/**
 * Semantic Context Retrieval Service
 *
 * Advanced context retrieval using semantic search, embedding similarity,
 * and intelligent ranking to find the most relevant context for any request.
 *
 * Features:
 * - Semantic similarity search using embeddings
 * - Multi-modal context retrieval (text, code, summaries)
 * - Intelligent relevance scoring and ranking
 * - Context fusion and deduplication
 * - Topic-based filtering and clustering
 */

import { createClient,type SupabaseClient } from '@supabase/supabase-js';

import { config } from '../config/environment';
import { log,LogContext } from '../utils/logger';
import { contextStorageService } from './context-storage-service';

interface SemanticSearchOptions {
  query: string;
  userId: string;
  maxResults?: number;
  minRelevanceScore?: number;
  contextTypes?: ContextType[];
  timeWindow?: number; // hours
  projectPath?: string;
  sessionId?: string;
  includeEmbeddings?: boolean;
  fuseSimilarResults?: boolean;
}

interface ContextType {
  type: 'conversation' | 'code' | 'documentation' | 'error' | 'summary' | 'knowledge';
  weight: number; // Relative importance 0-1
}

interface SemanticResult {
  id: string;
  content: string;
  contentType: string;
  source: string;
  relevanceScore: number;
  semanticScore: number;
  temporalScore: number;
  contextScore: number;
  combinedScore: number;
  embedding?: number[];
  metadata: {
    timestamp: Date;
    userId: string;
    projectPath?: string;
    sessionId?: string;
    tags: string[];
    topics: string[];
    wordCount: number;
    tokenCount: number;
  };
}

interface ClusteredResults {
  clusters: ContextCluster[];
  outliers: SemanticResult[];
  totalResults: number;
}

interface ContextCluster {
  id: string;
  topic: string;
  results: SemanticResult[];
  averageScore: number;
  centroid?: number[];
  summary: string;
}

interface RetrievalMetrics {
  searchTimeMs: number;
  totalResults: number;
  clusteredResults: number;
  averageRelevance: number;
  topicCoverage: number;
  embeddingComputeTime: number;
  databaseQueryTime: number;
}

export class SemanticContextRetrievalService {
  private supabase: SupabaseClient;
  private embeddingCache = new Map<string, { embedding: number[]; expiry: number }>();
  private readonly EMBEDDING_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly DEFAULT_EMBEDDING_MODEL = 'all-minilm:latest';
  private readonly similarityThreshold: number;
  private readonly MAX_CACHE_SIZE = 1000;

  // Scoring weights
  private readonly SCORING_WEIGHTS = {
    semantic: 0.4, // Embedding similarity
    temporal: 0.2, // Recency
    contextual: 0.25, // Context relevance (project, session)
    importance: 0.15, // Content importance
  };

  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
    // Allow env override for minimum similarity (applied to combined score threshold)
    const envMin = Number(process.env.CTX_MIN_SIMILARITY || '0.25');
    this.similarityThreshold = Number.isFinite(envMin) ? envMin : 0.25;
    log.info('🔍 Semantic Context Retrieval Service initialized', LogContext.CONTEXT_INJECTION, {
      embeddingModel: this.DEFAULT_EMBEDDING_MODEL,
      similarityThreshold: this.similarityThreshold,
      cacheSize: this.MAX_CACHE_SIZE,
    });
  }

  /**
   * Perform semantic search across all context types
   */
  async semanticSearch(options: SemanticSearchOptions): Promise<{
    results: SemanticResult[];
    clusters: ClusteredResults;
    metrics: RetrievalMetrics;
  }> {
    const startTime = Date.now();

    try {
      log.info('🔍 Starting semantic context search', LogContext.CONTEXT_INJECTION, {
        query: options.query.substring(0, 100),
        userId: options.userId,
        maxResults: options.maxResults || 20,
        contextTypes: options.contextTypes?.map((ct) => ct.type) || 'all',
      });

      // Generate query embedding
      const embeddingStart = Date.now();
      const queryEmbedding = await this.getQueryEmbedding(options.query);
      const embeddingTime = Date.now() - embeddingStart;

      if (!queryEmbedding) {
        throw new Error('Failed to generate query embedding');
      }

      // Search across different context sources
      const dbStart = Date.now();
      const [storedContextResults, conversationResults, knowledgeResults, summaryResults] =
        await Promise.all([
          this.searchStoredContext(options, queryEmbedding),
          this.searchConversationHistory(options, queryEmbedding),
          this.searchKnowledgeBase(options, queryEmbedding),
          this.searchContextSummaries(options, queryEmbedding),
        ]);
      const dbTime = Date.now() - dbStart;

      // Combine and deduplicate results
      const allResults = [
        ...storedContextResults,
        ...conversationResults,
        ...knowledgeResults,
        ...summaryResults,
      ];

      // Filter by minimum relevance
      const minScore = options.minRelevanceScore || this.similarityThreshold;
      const filteredResults = allResults.filter((r) => r.combinedScore >= minScore);

      // Sort by combined score and limit results (pre-rerank)
      const maxResults = options.maxResults || 20;
      const prelimTop = filteredResults
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, Math.max(maxResults * 2, 20));

      // Optional smart rerank when keys are present; otherwise skip silently
      let topResults = prelimTop;
      try {
        const hasHf = !!process.env.HUGGINGFACE_API_KEY;
        const hasOpenAI = !!process.env.OPENAI_API_KEY;
        if (prelimTop.length > 0 && (hasHf || hasOpenAI)) {
          const { rerankingService } = await import('./reranking-service');
          const reranked = await rerankingService.rerank(
            options.query,
            prelimTop.map((r) => ({
              id: r.id,
              content: r.content,
              metadata: r.metadata,
              biEncoderScore: r.combinedScore,
            })),
             { topK: maxResults, threshold: options.minRelevanceScore || this.similarityThreshold }
          );
          // Map back to SemanticResult ordering
          const byId = new Map(prelimTop.map((r) => [r.id, r] as const));
          topResults = reranked
            .map((rr) => byId.get(rr.id))
            .filter((x): x is SemanticResult => !!x);
        }
      } catch (e) {
        log.warn(
          '⚠️ Smart rerank unavailable, using bi-encoder ranking',
          LogContext.CONTEXT_INJECTION,
          {
            error: e instanceof Error ? e.message : String(e),
          }
        );
        topResults = prelimTop.slice(0, maxResults);
      }

      // Optionally fuse similar results
      const finalResults = options.fuseSimilarResults
        ? this.fuseSimilarResults(topResults, 0.85)
        : topResults;

      // Cluster results by topic/similarity
      const clusters = this.clusterResults(finalResults);

      // Calculate metrics
      const totalTime = Date.now() - startTime;
      const metrics: RetrievalMetrics = {
        searchTimeMs: totalTime,
        totalResults: allResults.length,
        clusteredResults: finalResults.length,
        averageRelevance:
          finalResults.length > 0
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
    } catch (error) {
      log.error('❌ Semantic search failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        query: options.query.substring(0, 50),
        userId: options.userId,
      });

      // Fallback to text search
      return this.fallbackTextSearch(options);
    }
  }

  /**
   * Search stored context with semantic similarity
   */
  private async searchStoredContext(
    options: SemanticSearchOptions,
    queryEmbedding: number[]
  ): Promise<SemanticResult[]> {
    try {
      // Prefer ANN search via Supabase RPC when available
      try {
        const { data, error } = await this.supabase.rpc('search_context_storage_by_embedding', {
          query_embedding: queryEmbedding,
          in_user_id: options.userId,
          in_category: null,
          in_limit: 100,
        } as any);

        if (!error && Array.isArray(data) && data.length > 0) {
          const annResults: SemanticResult[] = [];
          for (const row of data) {
            // Optional time window filter
            if (options.timeWindow && row.created_at) {
              const t = new Date(row.created_at).getTime();
              const cutoff = Date.now() - options.timeWindow * 60 * 60 * 1000;
              if (t < cutoff) {continue;}
            }

            const content: string = row.content || '';
            if (content.length < 10) {continue;}

            const semanticScore: number =
              typeof row.similarity === 'number'
                ? row.similarity
                : Math.max(0, Math.min(1, row.score || 0));

            if (semanticScore < this.similarityThreshold) {continue;}

            const temporalScore = this.calculateTemporalScore(
              new Date(row.created_at || Date.now())
            );
            const contextScore = this.calculateContextualScore(row, options);
            const importanceScore = this.calculateImportanceScore(
              content,
              row.category || 'conversation'
            );

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

          // If ANN returned results, use them
          if (annResults.length > 0) {
            log.info('🧠 Using ANN memory retrieval (Supabase)', LogContext.CONTEXT_INJECTION, {
              results: annResults.length,
            });
            return annResults;
          }
        }
      } catch (e) {
        log.warn(
          '⚠️ ANN RPC unavailable, falling back to client-side search',
          LogContext.CONTEXT_INJECTION,
          {
            error: e instanceof Error ? e.message : String(e),
          }
        );
      }

      // Fallback: fetch recent context and compute locally
      const storedContext = await contextStorageService.getContext(
        options.userId,
        undefined,
        options.projectPath,
        50
      );

      const results: SemanticResult[] = [];
      for (const context of storedContext) {
        if (options.timeWindow) {
          const contextTime = new Date(context.created_at).getTime();
          const cutoff = Date.now() - options.timeWindow * 60 * 60 * 1000;
          if (contextTime < cutoff) {continue;}
        }

        const contextEmbedding = await this.getContentEmbedding(context.content);
        if (!contextEmbedding) {continue;}

        const semanticScore = this.cosineSimilarity(queryEmbedding, contextEmbedding);
        if (semanticScore < this.similarityThreshold) {continue;}

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
    } catch (error) {
      log.error('❌ Stored context search failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Search conversation history with semantic similarity
   */
  private async searchConversationHistory(
    options: SemanticSearchOptions,
    queryEmbedding: number[]
  ): Promise<SemanticResult[]> {
    try {
      // Prefer context_storage category 'conversation' for conversation history
      const stored = await contextStorageService.getContext(
        options.userId,
        'conversation',
        options.projectPath,
        100
      );

      const results: SemanticResult[] = [];

      for (const conv of stored || []) {
        // Filter by time window if specified
        if (options.timeWindow) {
          const convTime = new Date(conv.created_at).getTime();
          const cutoff = Date.now() - options.timeWindow * 60 * 60 * 1000;
          if (convTime < cutoff) {continue;}
        }

        const content = conv.content || '';
        if (content.length < 10) {continue;} // Skip very short content

        // Get embedding
        const contentEmbedding = await this.getContentEmbedding(content);
        if (!contentEmbedding) {continue;}

        // Calculate similarity
        const semanticScore = this.cosineSimilarity(queryEmbedding, contentEmbedding);
        if (semanticScore < this.similarityThreshold) {continue;}

        // Calculate other scores
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
    } catch (error) {
      log.error('❌ Conversation search failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Search knowledge base with semantic similarity
   */
  private async searchKnowledgeBase(
    options: SemanticSearchOptions,
    queryEmbedding: number[]
  ): Promise<SemanticResult[]> {
    try {
      // Search knowledge_sources table if it exists
      const { data: knowledge, error } = await this.supabase
        .from('knowledge_sources')
        .select('*')
        .textSearch('content', options.query, { type: 'websearch' })
        .limit(30);

      if (error) {
        // Knowledge base might not exist, return empty
        return [];
      }

      const results: SemanticResult[] = [];

      for (const item of knowledge || []) {
        const content = item.content || '';
        if (content.length < 20) {continue;}

        // Get embedding
        const contentEmbedding = await this.getContentEmbedding(content);
        if (!contentEmbedding) {continue;}

        // Calculate similarity
        const semanticScore = this.cosineSimilarity(queryEmbedding, contentEmbedding);
        if (semanticScore < this.similarityThreshold) {continue;}

        // Calculate other scores
        const temporalScore = this.calculateTemporalScore(new Date(item.created_at || Date.now()));
        const contextScore = 0.7; // Knowledge base content is generally relevant
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
    } catch (error) {
      log.error('❌ Knowledge base search failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Search context summaries
   */
  private async searchContextSummaries(
    options: SemanticSearchOptions,
    queryEmbedding: number[]
  ): Promise<SemanticResult[]> {
    try {
      // Search for compressed summaries
      const summaries = await contextStorageService.searchContext(
        options.userId,
        options.query,
        'conversation',
        20
      );

      const results: SemanticResult[] = [];

      for (const summary of summaries) {
        // Only process summaries
        if (!summary.metadata?.summaryType) {continue;}

        const { content } = summary;

        // Get embedding
        const contentEmbedding = await this.getContentEmbedding(content);
        if (!contentEmbedding) {continue;}

        // Calculate similarity
        const semanticScore = this.cosineSimilarity(queryEmbedding, contentEmbedding);
        if (semanticScore < this.similarityThreshold) {continue;}

        // Calculate other scores
        const temporalScore = this.calculateTemporalScore(new Date(summary.created_at));
        const contextScore = this.calculateContextualScore(summary, options);
        const importanceScore = 0.6; // Summaries are moderately important

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
    } catch (error) {
      log.error('❌ Summary search failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get or generate embedding for query
   */
  private async getQueryEmbedding(query: string): Promise<number[] | null> {
    return this.getContentEmbedding(query);
  }

  /**
   * Get or generate embedding for content with caching
   */
  private async getContentEmbedding(content: string): Promise<number[] | null> {
    try {
      // Create cache key
      const cacheKey = this.createCacheKey(content);

      // Check cache first
      const cached = this.embeddingCache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        return cached.embedding;
      }

      // Generate new embedding
      const embedding = await this.generateEmbedding(content);
      if (!embedding) {return null;}

      // Cache the result
      this.cacheEmbedding(cacheKey, embedding);

      return embedding;
    } catch (error) {
      log.error('❌ Embedding generation failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        contentLength: content.length,
      });
      return null;
    }
  }

  /**
   * Generate embedding using Ollama
   */
  private async generateEmbedding(content: string): Promise<number[] | null> {
    try {
      // Truncate content if too long (embeddings have limits)
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
    } catch (error) {
      log.warn(
        '⚠️ Embedding generation via Ollama failed, using fallback',
        LogContext.CONTEXT_INJECTION,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );

      // Simple fallback: generate pseudo-embedding from content
      return this.generateFallbackEmbedding(content);
    }
  }

  /**
   * Generate simple fallback embedding from text features
   */
  private generateFallbackEmbedding(content: string): number[] {
    const embedding = new Array(384).fill(0); // Standard embedding size
    const words = content.toLowerCase().split(/\s+/);

    // Simple hash-based embedding generation
    for (let i = 0; i < words.length && i < 100; i++) {
      const word = words[i];
      if (!word) {continue;}
      const hash = this.simpleHash(word);
      const index = Math.abs(hash) % embedding.length;
      embedding[index] += 1 / (i + 1); // Diminishing weight for later words
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map((val) => val / magnitude) : embedding;
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
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

    if (normA === 0 || normB === 0) {return 0;}

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Calculate temporal relevance score
   */
  private calculateTemporalScore(timestamp: Date): number {
    const now = Date.now();
    const age = now - timestamp.getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    // Recent content gets higher scores
    if (age < dayMs) {return 1.0;}
    if (age < 7 * dayMs) {return 0.8;}
    if (age < 30 * dayMs) {return 0.6;}
    if (age < 90 * dayMs) {return 0.4;}

    return 0.2;
  }

  /**
   * Calculate contextual relevance score
   */
  private calculateContextualScore(context: any, options: SemanticSearchOptions): number {
    let score = 0.5; // Base score

    // Project path matching
    if (options.projectPath && context.projectPath === options.projectPath) {
      score += 0.3;
    }

    // Session matching
    if (options.sessionId && context.metadata?.sessionId === options.sessionId) {
      score += 0.2;
    }

    return Math.min(1.0, score);
  }

  /**
   * Calculate contextual score from metadata
   */
  private calculateContextualScoreFromMetadata(
    metadata: any,
    options: SemanticSearchOptions
  ): number {
    let score = 0.5;

    if (options.sessionId && metadata.sessionId === options.sessionId) {
      score += 0.3;
    }

    return Math.min(1.0, score);
  }

  /**
   * Calculate content importance score
   */
  private calculateImportanceScore(content: string, type: string): number {
    let score = 0.5; // Base score

    // Content type importance
    const typeScores: Record<string, number> = {
      conversation: 0.7,
      code: 0.8,
      error: 0.9,
      summary: 0.6,
      knowledge: 0.8,
      project_info: 0.75,
      verified_answer: 0.9,
    };

    score = typeScores[type] || 0.5;

    // Content features
    const lowerContent = content.toLowerCase();

    // Questions are important
    if (lowerContent.includes('?') || lowerContent.match(/^(what|how|why|when|where)/)) {
      score += 0.1;
    }

    // Errors are important
    if (lowerContent.includes('error') || lowerContent.includes('failed')) {
      score += 0.2;
    }

    // Code is important
    if (lowerContent.includes('```') || lowerContent.includes('function')) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }

  /**
   * Combine multiple scores into final score
   */
  private combineScores(scores: {
    semantic: number;
    temporal: number;
    contextual: number;
    importance: number;
  }): number {
    return (
      scores.semantic * this.SCORING_WEIGHTS.semantic +
      scores.temporal * this.SCORING_WEIGHTS.temporal +
      scores.contextual * this.SCORING_WEIGHTS.contextual +
      scores.importance * this.SCORING_WEIGHTS.importance
    );
  }

  /**
   * Cluster results by similarity
   */
  private clusterResults(results: SemanticResult[]): ClusteredResults {
    if (results.length === 0) {
      return { clusters: [], outliers: [], totalResults: 0 };
    }

    const clusters: ContextCluster[] = [];
    const outliers: SemanticResult[] = [];
    const processed = new Set<string>();

    // Simple clustering based on topic similarity
    for (const result of results) {
      if (processed.has(result.id)) {continue;}

      const cluster: ContextCluster = {
        id: `cluster_${clusters.length}`,
        topic: this.extractPrimaryTopic(result),
        results: [result],
        averageScore: result.combinedScore,
        summary: `${result.content.substring(0, 200)}...`,
      };

      processed.add(result.id);

      // Find similar results to add to cluster
      for (const other of results) {
        if (processed.has(other.id) || other.id === result.id) {continue;}

        // Check topic similarity
        const topicSimilarity = this.calculateTopicSimilarity(result, other);
        if (topicSimilarity > 0.6) {
          cluster.results.push(other);
          processed.add(other.id);
        }
      }

      // Update cluster metrics
      if (cluster.results.length > 1) {
        cluster.averageScore =
          cluster.results.reduce((sum, r) => sum + r.combinedScore, 0) / cluster.results.length;

        cluster.summary = this.createClusterSummary(cluster.results);
      }

      // Add to clusters or outliers
      if (cluster.results.length >= 2) {
        clusters.push(cluster);
      } else {
        outliers.push(result);
      }
    }

    return {
      clusters: clusters.sort((a, b) => b.averageScore - a.averageScore),
      outliers: outliers.sort((a, b) => b.combinedScore - a.combinedScore),
      totalResults: results.length,
    };
  }

  /**
   * Fuse similar results to reduce redundancy
   */
  private fuseSimilarResults(results: SemanticResult[], threshold = 0.85): SemanticResult[] {
    const fused: SemanticResult[] = [];
    const processed = new Set<string>();

    for (const result of results) {
      if (processed.has(result.id)) {continue;}

      // Find similar results
      const similar = results.filter(
        (r) =>
          !processed.has(r.id) &&
          r.id !== result.id &&
          this.calculateContentSimilarity(result.content, r.content) > threshold
      );

      if (similar.length > 0) {
        // Create fused result
        const allResults = [result, ...similar];
        const fusedResult: SemanticResult = {
          ...result,
          id: `fused_${result.id}`,
          content: this.fuseContent(allResults),
          combinedScore:
            allResults.reduce((sum, r) => sum + r.combinedScore, 0) / allResults.length,
          metadata: {
            ...result.metadata,
            tags: [...new Set(allResults.flatMap((r) => r.metadata.tags))],
            topics: [...new Set(allResults.flatMap((r) => r.metadata.topics))],
          },
        };

        fused.push(fusedResult);

        // Mark all as processed
        allResults.forEach((r) => processed.add(r.id));
      } else {
        fused.push(result);
        processed.add(result.id);
      }
    }

    return fused;
  }

  /**
   * Calculate topic similarity between results
   */
  private calculateTopicSimilarity(a: SemanticResult, b: SemanticResult): number {
    const aTopics = new Set(a.metadata.topics);
    const bTopics = new Set(b.metadata.topics);

    const intersection = new Set([...aTopics].filter((t) => bTopics.has(t)));
    const union = new Set([...aTopics, ...bTopics]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate content similarity using simple text overlap
   */
  private calculateContentSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));

    const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
    const union = new Set([...wordsA, ...wordsB]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Extract primary topic from result
   */
  private extractPrimaryTopic(result: SemanticResult): string {
    if (result.metadata.topics.length > 0) {
      return result.metadata.topics[0] || 'general';
    }

    // Fallback: extract from content
    const topics = this.extractTopics(result.content);
    return topics[0] || 'general';
  }

  /**
   * Create cluster summary
   */
  private createClusterSummary(results: SemanticResult[]): string {
    const allTopics = [...new Set(results.flatMap((r) => r.metadata.topics))];
    const primaryTopic = allTopics[0] || 'discussion';

    return (
      `Cluster of ${results.length} related items about ${primaryTopic}. ` +
      `Average relevance: ${(results.reduce((sum, r) => sum + r.combinedScore, 0) / results.length).toFixed(2)}`
    );
  }

  /**
   * Fuse content from multiple results
   */
  private fuseContent(results: SemanticResult[]): string {
    // Take the highest scoring result as primary, others as supporting
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

  /**
   * Extract tags from content
   */
  private extractTags(content: string): string[] {
    const tags: string[] = [];
    const lowerContent = content.toLowerCase();

    // Technical tags
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

  /**
   * Extract topics from content
   */
  private extractTopics(content: string): string[] {
    const topics: string[] = [];
    const lowerContent = content.toLowerCase();

    // Topic categories
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

  /**
   * Create cache key for content
   */
  private createCacheKey(content: string): string {
    // Use first 100 characters + length as cache key
    const prefix = content.substring(0, 100);
    return `${prefix.replace(/\s+/g, '_')}_${content.length}`;
  }

  /**
   * Cache embedding with TTL
   */
  private cacheEmbedding(key: string, embedding: number[]): void {
    // Manage cache size
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

  /**
   * Fallback to simple text search when semantic search fails
   */
  private async fallbackTextSearch(options: SemanticSearchOptions): Promise<{
    results: SemanticResult[];
    clusters: ClusteredResults;
    metrics: RetrievalMetrics;
  }> {
    try {
      log.info('🔄 Falling back to text search', LogContext.CONTEXT_INJECTION, {
        query: options.query.substring(0, 50),
      });

      const startTime = Date.now();

      // Use existing text search from context storage service
      const textResults = await contextStorageService.searchContext(
        options.userId,
        options.query,
        undefined,
        options.maxResults || 20
      );

      const results: SemanticResult[] = textResults.map((result) => ({
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
    } catch (error) {
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

  /**
   * Clear embedding cache
   */
  public clearCache(): void {
    this.embeddingCache.clear();
    log.info('🧹 Semantic retrieval cache cleared', LogContext.CONTEXT_INJECTION);
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; hitRate: number; memoryUsage: number } {
    const { size } = this.embeddingCache;

    // Estimate memory usage (each embedding is ~384 floats = ~1.5KB)
    const memoryUsage = size * 1.5; // KB

    return {
      size,
      hitRate: 0, // Would need to track hits vs misses
      memoryUsage,
    };
  }
}

// Export singleton instance
export const semanticContextRetrievalService = new SemanticContextRetrievalService();
export default semanticContextRetrievalService;

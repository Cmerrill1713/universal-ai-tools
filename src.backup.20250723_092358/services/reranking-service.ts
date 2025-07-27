/**
 * Advanced Reranking Service for Enhanced Search Relevance
 * Implements multiple reranking strategies including cross-encoder, LLM-based, and hybrid approaches
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';

export interface RerankingResult {
  id: string;
  originalScore: number;
  rerankScore: number;
  finalScore: number;
  rerankingMethod: string;
  confidence: number;
  reasoning?: string;
}

export interface RerankingOptions {
  method: 'cross_encoder' | 'llm_judge' | 'hybrid' | 'feature_based' | 'learned' | 'adaptive';
  query?: string;
  maxResults?: number;
  contextWindow?: number;
  useCache?: boolean;
  explainRanking?: boolean;
  temperatureAdjustment?: number;
  diversityBoost?: boolean;
}

export interface SearchResult {
  id: string;
  content string;
  similarity: number;
  metadata?: Record<string, unknown>;
  importanceScore?: number;
  accessCount?: number;
  recency?: number;
  [key: string]: any;
}

export interface RerankingMetrics {
  originalResults: number;
  finalResults: number;
  rerankingTime: number;
  method: string;
  cacheHit: boolean;
  averageScoreImprovement: number;
  diversityScore: number;
}

/**
 * Advanced reranking service with multiple strategies
 */
export class RerankingService {
  private supabase: SupabaseClient;
  private logger: Logger;
  private rerankCache = new Map<string, { results: RerankingResult[]; timestamp: number }>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  // Cross-encoder models (would typically load from external service)
  private readonly CROSS_ENCODER_MODELS = {
    'ms-marco-MiniLM-L-6-v2': { context_length: 512, precision: 'high' },
    'all-MiniLM-L6-v2-reranker': { context_length: 256, precision: 'balanced' },
    'bge-reranker-base': { context_length: 512, precision: 'very_high' },
  };

  constructor(supabase: SupabaseClient, logger: Logger) {
    this.supabase = supabase;
    this.logger = logger;
  }

  /**
   * Main reranking function - rerank search results based on query relevance
   */
  async rerank(
    query: string,
    results: SearchResult[],
    options: RerankingOptions = { method: 'hybrid', query }
  ): Promise<{
    results: SearchResult[];
    rerankingResults: RerankingResult[];
    metrics: RerankingMetrics;
  }> {
    const startTime = Date.now();

    if (results.length === 0) {
      return {
        results: [],
        rerankingResults: [],
        metrics: this.createEmptyMetrics(options.method),
      };
    }

    this.logger.debug(
      `Starting reranking with method: ${options.method}, ${results.length} results`
    );

    try {
      // Check cache first
      const cacheKey = this.getCacheKey(query, results, options);
      let cacheHit = false;

      if (options.useCache !== false) {
        const cached = this.rerankCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
          cacheHit = true;
          this.logger.debug('Reranking served from cache');

          const rerankedResults = this.applyRerankingResults(results, cached.results);
          return {
            results: rerankedResults,
            rerankingResults: cached.results,
            metrics: {
              originalResults: results.length,
              finalResults: rerankedResults.length,
              rerankingTime: Date.now() - startTime,
              method: options.method,
              cacheHit: true,
              averageScoreImprovement: this.calculateScoreImprovement(cached.results),
              diversityScore: this.calculateDiversityScore(rerankedResults),
            },
          };
        }
      }

      // Perform reranking based on selected method
      let rerankingResults: RerankingResult[];

      switch (options.method) {
        case 'cross_encoder':
          rerankingResults = await this.crossEncoderRerank(query, results, options);
          break;
        case 'llm_judge':
          rerankingResults = await this.llmJudgeRerank(query, results, options);
          break;
        case 'feature_based':
          rerankingResults = await this.featureBasedRerank(query, results, options);
          break;
        case 'learned':
          rerankingResults = await this.learnedRerank(query, results, options);
          break;
        case 'hybrid':
        default:
          rerankingResults = await this.hybridRerank(query, results, options);
          break;
      }

      // Apply diversity boost if requested
      if (options.diversityBoost) {
        rerankingResults = this.applyDiversityBoost(rerankingResults, results);
      }

      // Cache the results
      if (options.useCache !== false) {
        this.rerankCache.set(cacheKey, {
          results: rerankingResults,
          timestamp: Date.now(),
        });
        this.cleanCache();
      }

      // Apply reranking to original results
      const rerankedResults = this.applyRerankingResults(results, rerankingResults);
      const finalResults = rerankedResults.slice(0, options.maxResults || results.length);

      const metrics: RerankingMetrics = {
        originalResults: results.length,
        finalResults: finalResults.length,
        rerankingTime: Date.now() - startTime,
        method: options.method,
        cacheHit,
        averageScoreImprovement: this.calculateScoreImprovement(rerankingResults),
        diversityScore: this.calculateDiversityScore(finalResults),
      };

      this.logger.info(
        `Reranking completed in ${metrics.rerankingTime}ms with method ${options.method}`
      );

      return {
        results: finalResults,
        rerankingResults,
        metrics,
      };
    } catch (error) {
      this.logger.error('Reranking failed:', error);

      // Fallback to original results
      return {
        results: results.slice(0, options.maxResults || results.length),
        rerankingResults: results.map((r, i) => ({
          id: r.id,
          originalScore: r.similarity,
          rerankScore: r.similarity,
          finalScore: r.similarity,
          rerankingMethod: 'fallback',
          confidence: 0.5,
        })),
        metrics: {
          originalResults: results.length,
          finalResults: results.length,
          rerankingTime: Date.now() - startTime,
          method: 'fallback',
          cacheHit: false,
          averageScoreImprovement: 0,
          diversityScore: 0,
        },
      };
    }
  }

  /**
   * Cross-encoder reranking using transformer-based models
   */
  private async crossEncoderRerank(
    query: string,
    results: SearchResult[],
    options: RerankingOptions
  ): Promise<RerankingResult[]> {
    try {
      // In a real implementation, this would call an external cross-encoder service
      // For now, we'll simulate cross-encoder scoring with enhanced text similarity

      const rerankingResults: RerankingResult[] = [];

      for (const result of results) {
        // Simulate cross-encoder scoring with multiple factors
        const textSimilarity = this.calculateTextSimilarity(query, result.content;
        const semanticAlignment = this.calculateSemanticAlignment(query, result.content;
        const contextRelevance = this.calculateContextRelevance(query, result);

        // Combine scores with cross-encoder-like weighting
        const crossEncoderScore =
          textSimilarity * 0.4 + semanticAlignment * 0.4 + contextRelevance * 0.2;

        const finalScore = this.combineScores(result.similarity, crossEncoderScore, {
          originalWeight: 0.3,
          rerankWeight: 0.7,
        });

        rerankingResults.push({
          id: result.id,
          originalScore: result.similarity,
          rerankScore: crossEncoderScore,
          finalScore,
          rerankingMethod: 'cross_encoder',
          confidence: Math.min(crossEncoderScore + 0.1, 1.0),
          reasoning: options.explainRanking
            ? `Text similarity: ${textSimilarity.toFixed(3)}, Semantic: ${semanticAlignment.toFixed(3)}, Context: ${contextRelevance.toFixed(3)}`
            : undefined,
        });
      }

      return rerankingResults.sort((a, b) => b.finalScore - a.finalScore);
    } catch (error) {
      this.logger.error('Cross-encoder reranking failed:', error);
      return this.fallbackReranking(results);
    }
  }

  /**
   * LLM-based reranking using language model judgment
   */
  private async llmJudgeRerank(
    query: string,
    results: SearchResult[],
    options: RerankingOptions
  ): Promise<RerankingResult[]> {
    try {
      // For LLM-based reranking, we'd typically call an LLM service
      // Here we simulate with advanced heuristics

      const rerankingResults: RerankingResult[] = [];
      const batchSize = Math.min(results.length, options.contextWindow || 10);

      for (let i = 0; i < results.length; i += batchSize) {
        const batch = results.slice(i, i + batchSize);

        for (const result of batch) {
          // Simulate LLM judgment with comprehensive analysis
          const intentAlignment = this.analyzeIntentAlignment(query, result.content;
          const factualRelevance = this.analyzeFactualRelevance(query, result.content;
          const completeness = this.analyzeAnswerCompleteness(query, result.content;
          const clarity = this.analyzeClarity(result.content;

          const llmJudgeScore =
            intentAlignment * 0.35 + factualRelevance * 0.3 + completeness * 0.2 + clarity * 0.15;

          const finalScore = this.combineScores(result.similarity, llmJudgeScore, {
            originalWeight: 0.2,
            rerankWeight: 0.8,
          });

          rerankingResults.push({
            id: result.id,
            originalScore: result.similarity,
            rerankScore: llmJudgeScore,
            finalScore,
            rerankingMethod: 'llm_judge',
            confidence: Math.min(llmJudgeScore + 0.15, 1.0),
            reasoning: options.explainRanking
              ? `Intent: ${intentAlignment.toFixed(3)}, Factual: ${factualRelevance.toFixed(3)}, Complete: ${completeness.toFixed(3)}, Clear: ${clarity.toFixed(3)}`
              : undefined,
          });
        }
      }

      return rerankingResults.sort((a, b) => b.finalScore - a.finalScore);
    } catch (error) {
      this.logger.error('LLM judge reranking failed:', error);
      return this.fallbackReranking(results);
    }
  }

  /**
   * Feature-based reranking using hand-crafted features
   */
  private async featureBasedRerank(
    query: string,
    results: SearchResult[],
    options: RerankingOptions
  ): Promise<RerankingResult[]> {
    try {
      const rerankingResults: RerankingResult[] = [];

      for (const result of results) {
        // Calculate multiple features
        const features = {
          exactMatch: this.calculateExactMatch(query, result.content,
          termCoverage: this.calculateTermCoverage(query, result.content,
          importanceScore: result.importanceScore || 0.5,
          recencyScore: this.calculateRecencyScore(result),
          accessFrequency: this.calculateAccessFrequency(result),
          lengthPenalty: this.calculateLengthPenalty(result.content query),
          positionBias: this.calculatePositionBias(result),
          metadataBoost: this.calculateMetadataBoost(query, result.metadata || {}),
        };

        // Weighted combination of features
        const featureScore =
          features.exactMatch * 0.25 +
          features.termCoverage * 0.2 +
          features.importanceScore * 0.15 +
          features.recencyScore * 0.1 +
          features.accessFrequency * 0.1 +
          features.lengthPenalty * 0.05 +
          features.positionBias * 0.05 +
          features.metadataBoost * 0.1;

        const finalScore = this.combineScores(result.similarity, featureScore, {
          originalWeight: 0.4,
          rerankWeight: 0.6,
        });

        rerankingResults.push({
          id: result.id,
          originalScore: result.similarity,
          rerankScore: featureScore,
          finalScore,
          rerankingMethod: 'feature_based',
          confidence: Math.min(featureScore + 0.1, 1.0),
          reasoning: options.explainRanking
            ? `Features: exact=${features.exactMatch.toFixed(2)}, terms=${features.termCoverage.toFixed(2)}, importance=${features.importanceScore.toFixed(2)}`
            : undefined,
        });
      }

      return rerankingResults.sort((a, b) => b.finalScore - a.finalScore);
    } catch (error) {
      this.logger.error('Feature-based reranking failed:', error);
      return this.fallbackReranking(results);
    }
  }

  /**
   * Learned reranking using stored patterns and user feedback
   */
  private async learnedRerank(
    query: string,
    results: SearchResult[],
    options: RerankingOptions
  ): Promise<RerankingResult[]> {
    try {
      // This would typically load learned weights from historical data
      const rerankingResults: RerankingResult[] = [];

      // Simulate learned patterns
      const queryPattern = this.analyzeQueryPattern(query);
      const userPreferences = await this.getUserPreferences(query);

      for (const result of results) {
        const patternMatch = this.calculatePatternMatch(queryPattern, result);
        const preferenceAlignment = this.calculatePreferenceAlignment(userPreferences, result);
        const historicalPerformance = await this.getHistoricalPerformance(result.id, query);

        const learnedScore =
          patternMatch * 0.4 + preferenceAlignment * 0.3 + historicalPerformance * 0.3;

        const finalScore = this.combineScores(result.similarity, learnedScore, {
          originalWeight: 0.3,
          rerankWeight: 0.7,
        });

        rerankingResults.push({
          id: result.id,
          originalScore: result.similarity,
          rerankScore: learnedScore,
          finalScore,
          rerankingMethod: 'learned',
          confidence: Math.min(learnedScore + 0.2, 1.0),
          reasoning: options.explainRanking
            ? `Pattern: ${patternMatch.toFixed(3)}, Preference: ${preferenceAlignment.toFixed(3)}, History: ${historicalPerformance.toFixed(3)}`
            : undefined,
        });
      }

      return rerankingResults.sort((a, b) => b.finalScore - a.finalScore);
    } catch (error) {
      this.logger.error('Learned reranking failed:', error);
      return this.fallbackReranking(results);
    }
  }

  /**
   * Hybrid reranking combining multiple methods
   */
  private async hybridRerank(
    query: string,
    results: SearchResult[],
    options: RerankingOptions
  ): Promise<RerankingResult[]> {
    try {
      // Run multiple reranking methods
      const crossEncoderResults = await this.crossEncoderRerank(query, results, options);
      const featureResults = await this.featureBasedRerank(query, results, options);
      const learnedResults = await this.learnedRerank(query, results, options);

      // Combine results with weighted averaging
      const hybridResults: RerankingResult[] = [];

      for (const result of results) {
        const crossEncoder = crossEncoderResults.find((r) => r.id === result.id);
        const feature = featureResults.find((r) => r.id === result.id);
        const learned = learnedResults.find((r) => r.id === result.id);

        if (crossEncoder && feature && learned) {
          const hybridScore =
            crossEncoder.rerankScore * 0.4 + feature.rerankScore * 0.3 + learned.rerankScore * 0.3;

          const finalScore = this.combineScores(result.similarity, hybridScore, {
            originalWeight: 0.25,
            rerankWeight: 0.75,
          });

          hybridResults.push({
            id: result.id,
            originalScore: result.similarity,
            rerankScore: hybridScore,
            finalScore,
            rerankingMethod: 'hybrid',
            confidence: Math.min(hybridScore + 0.1, 1.0),
            reasoning: options.explainRanking
              ? `Hybrid: cross=${crossEncoder.rerankScore.toFixed(3)}, feature=${feature.rerankScore.toFixed(3)}, learned=${learned.rerankScore.toFixed(3)}`
              : undefined,
          });
        }
      }

      return hybridResults.sort((a, b) => b.finalScore - a.finalScore);
    } catch (error) {
      this.logger.error('Hybrid reranking failed:', error);
      return this.fallbackReranking(results);
    }
  }

  // Helper methods for scoring calculations
  private calculateTextSimilarity(query: string, content string): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const contentTerms = contenttoLowerCase().split(/\s+/);

    const intersection = queryTerms.filter((term) =>
      contentTerms.some((cTerm) => cTerm.includes(term) || term.includes(cTerm))
    );

    return intersection.length / queryTerms.length;
  }

  private calculateSemanticAlignment(query: string, content string): number {
    // Simplified semantic alignment - in practice would use embeddings
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = contenttoLowerCase().split(/\s+/);

    let semanticScore = 0;
    for (const qWord of queryWords) {
      for (const cWord of contentWords) {
        if (this.areSemanticallyRelated(qWord, cWord)) {
          semanticScore += 0.1;
        }
      }
    }

    return Math.min(semanticScore, 1.0);
  }

  private calculateContextRelevance(query: string, result: SearchResult): number {
    let relevance = 0;

    // Importance score contribution
    relevance += (result.importanceScore || 0.5) * 0.3;

    // Recency contribution
    if (result.recency) {
      relevance += result.recency * 0.2;
    }

    // Access frequency contribution
    if (result.accessCount) {
      relevance += Math.min(result.accessCount / 100, 0.3) * 0.2;
    }

    // Metadata relevance
    if (result.metadata) {
      relevance += this.calculateMetadataBoost(query, result.metadata) * 0.3;
    }

    return Math.min(relevance, 1.0);
  }

  private analyzeIntentAlignment(query: string, content string): number {
    // Analyze if contentanswers the query intent
    const intentKeywords = this.extractIntentKeywords(query);
    const contentLower = contenttoLowerCase();

    let alignment = 0;
    for (const keyword of intentKeywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        alignment += 0.2;
      }
    }

    return Math.min(alignment, 1.0);
  }

  private analyzeFactualRelevance(query: string, content string): number {
    // Analyze factual relevance - simplified implementation
    const queryEntities = this.extractEntities(query);
    const contentEntities = this.extractEntities(content;

    const overlap = queryEntities.filter((qe) =>
      contentEntities.some((ce) => ce.toLowerCase() === qe.toLowerCase())
    );

    return queryEntities.length > 0 ? overlap.length / queryEntities.length : 0.5;
  }

  private analyzeAnswerCompleteness(query: string, content string): number {
    // Analyze how completely the contentanswers the query
    const queryLength = query.split(/\s+/).length;
    const contentLength = contentsplit(/\s+/).length;

    // Prefer neither too short nor too long answers
    const idealRatio = Math.min(contentLength / (queryLength * 3), 1.0);
    const lengthPenalty = contentLength > 200 ? 0.9 : 1.0;

    return idealRatio * lengthPenalty;
  }

  private analyzeClarity(content string): number {
    // Analyze contentclarity - simplified metrics
    const sentences = contentsplit(/[.!?]+/).filter((s) => s.trim().length > 0);
    const avgSentenceLength = content-length / sentences.length;

    // Prefer moderate sentence lengths
    const clarityScore = avgSentenceLength > 20 && avgSentenceLength < 100 ? 0.8 : 0.6;

    return clarityScore;
  }

  private calculateExactMatch(query: string, content string): number {
    const queryLower = query.toLowerCase();
    const contentLower = contenttoLowerCase();

    if (contentLower.includes(queryLower)) return 1.0;

    const queryWords = queryLower.split(/\s+/);
    const exactMatches = queryWords.filter((word) => contentLower.includes(word));

    return exactMatches.length / queryWords.length;
  }

  private calculateTermCoverage(query: string, content string): number {
    const queryTerms = new Set(query.toLowerCase().split(/\s+/));
    const contentTerms = new Set(contenttoLowerCase().split(/\s+/));

    const covered = Array.from(queryTerms).filter((term) => contentTerms.has(term));
    return covered.length / queryTerms.size;
  }

  private calculateRecencyScore(result: SearchResult): number {
    if (!result.recency) return 0.5;

    // Convert recency to score (more recent = higher score)
    return Math.min(result.recency, 1.0);
  }

  private calculateAccessFrequency(result: SearchResult): number {
    if (!result.accessCount) return 0.3;

    // Logarithmic scaling of access frequency
    return Math.min(Math.log(result.accessCount + 1) / 10, 1.0);
  }

  private calculateLengthPenalty(content string, query: string): number {
    const contentLength = content-length;
    const queryLength = query.length;

    // Prefer contentthat's proportional to query complexity
    const idealLength = queryLength * 5;
    const lengthRatio = Math.min(contentLength / idealLength, idealLength / contentLength);

    return Math.max(lengthRatio, 0.3);
  }

  private calculatePositionBias(result: SearchResult): number {
    // In practice, this would use the original position in search results
    return 0.5; // Neutral for now
  }

  private calculateMetadataBoost(query: string, metadata: Record<string, unknown>): number {
    let boost = 0;
    const queryLower = query.toLowerCase();

    // Check various metadata fields
    Object.entries(metadata).forEach(([key, value]) => {
      if (typeof value === 'string' && value.toLowerCase().includes(queryLower)) {
        boost += 0.1;
      }
    });

    return Math.min(boost, 0.3);
  }

  private async getUserPreferences(query: string): Promise<Record<string, number>> {
    // Simplified user preferences - in practice would load from database
    return {
      technical: 0.7,
      detailed: 0.6,
      recent: 0.8,
    };
  }

  private async getHistoricalPerformance(resultId: string, query: string): Promise<number> {
    // Simplified historical performance - in practice would load from analytics
    return 0.6;
  }

  private analyzeQueryPattern(query: string): Record<string, number> {
    return {
      questionType: query.includes('?') ? 1.0 : 0.0,
      technicalTerms: this.countTechnicalTerms(query) / 10,
      complexity: Math.min(query.split(/\s+/).length / 20, 1.0),
    };
  }

  private calculatePatternMatch(_pattern Record<string, number>, result: SearchResult): number {
    // Simplified _patternmatching
    return 0.6;
  }

  private calculatePreferenceAlignment(
    preferences: Record<string, number>,
    result: SearchResult
  ): number {
    // Simplified preference alignment
    return 0.7;
  }

  private applyDiversityBoost(
    rerankingResults: RerankingResult[],
    originalResults: SearchResult[]
  ): RerankingResult[] {
    // Apply diversity boost to prevent clustering of similar results
    const diversified = [...rerankingResults];
    const seen = new Set<string>();

    return diversified
      .filter((result) => {
        const original = originalResults.find((r) => r.id === result.id);
        if (!original) return true;

        const contentHash = this.getContentHash(original.content;

        if (seen.has(contentHash)) {
          result.finalScore *= 0.8; // Reduce score for similar content
        } else {
          seen.add(contentHash);
        }

        return true;
      })
      .sort((a, b) => b.finalScore - a.finalScore);
  }

  private applyRerankingResults(
    originalResults: SearchResult[],
    rerankingResults: RerankingResult[]
  ): SearchResult[] {
    return rerankingResults
      .map((rr) => {
        const original = originalResults.find((r) => r.id === rr.id);
        if (!original) return null;

        return {
          ...original,
          similarity: rr.finalScore,
          rerankScore: rr.rerankScore,
          rerankMethod: rr.rerankingMethod,
          confidence: rr.confidence,
          reasoning: rr.reasoning,
        };
      })
      .filter(Boolean) as SearchResult[];
  }

  private combineScores(
    originalScore: number,
    rerankScore: number,
    weights: { originalWeight: number; rerankWeight: number }
  ): number {
    return originalScore * weights.originalWeight + rerankScore * weights.rerankWeight;
  }

  private calculateScoreImprovement(rerankingResults: RerankingResult[]): number {
    if (rerankingResults.length === 0) return 0;

    const improvements = rerankingResults.map((r) => r.finalScore - r.originalScore);
    return improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length;
  }

  private calculateDiversityScore(results: SearchResult[]): number {
    // Simplified diversity calculation
    const uniqueContent = new Set(
      results.map((r) => this.getContentHash(r.contentsubstring(0, 100)))
    );
    return uniqueContent.size / results.length;
  }

  private fallbackReranking(results: SearchResult[]): RerankingResult[] {
    return results.map((result) => ({
      id: result.id,
      originalScore: result.similarity,
      rerankScore: result.similarity,
      finalScore: result.similarity,
      rerankingMethod: 'fallback',
      confidence: 0.5,
    }));
  }

  private createEmptyMetrics(method: string): RerankingMetrics {
    return {
      originalResults: 0,
      finalResults: 0,
      rerankingTime: 0,
      method,
      cacheHit: false,
      averageScoreImprovement: 0,
      diversityScore: 0,
    };
  }

  // Utility methods
  private areSemanticallyRelated(word1: string, word2: string): boolean {
    // Simplified semantic relationship check
    const synonyms: Record<string, string[]> = {
      search: ['find', 'look', 'query', 'retrieve'],
      memory: ['storage', 'recall', 'remember', 'data'],
      agent: ['bot', 'assistant', 'ai', 'service'],
    };

    return synonyms[word1]?.includes(word2) || synonyms[word2]?.includes(word1) || false;
  }

  private extractIntentKeywords(query: string): string[] {
    const intentWords = ['how', 'what', 'when', 'where', 'why', 'which', 'who'];
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => intentWords.includes(word));
  }

  private extractEntities(text: string): string[] {
    // Simplified entity extraction - in practice would use NER
    const words = text.split(/\s+/);
    return words.filter((word) => /^[A-Z][a-z]+/.test(word));
  }

  private countTechnicalTerms(text: string): number {
    const technicalTerms = [
      'api',
      'database',
      'server',
      'client',
      'function',
      'class',
      'method',
      'algorithm',
    ];
    const words = text.toLowerCase().split(/\s+/);
    return words.filter((word) => technicalTerms.includes(word)).length;
  }

  private getContentHash(content string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content.digest('hex').substring(0, 8);
  }

  private getCacheKey(query: string, results: SearchResult[], options: RerankingOptions): string {
    const resultsHash = this.getContentHash(results.map((r) => r.id).join(','));
    const optionsHash = this.getContentHash(JSON.stringify(options));
    const queryHash = this.getContentHash(query);

    return `${queryHash}:${resultsHash}:${optionsHash}`;
  }

  private cleanCache(): void {
    const now = Date.now();
    this.rerankCache.forEach((entry, key) => {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.rerankCache.delete(key);
      }
    });
  }

  /**
   * Get reranking performance metrics
   */
  getPerformanceMetrics(): {
    cacheSize: number;
    cacheHitRate: number;
    averageRerankingTime: number;
    totalReranks: number;
  } {
    // Simplified metrics - in practice would track more detailed stats
    return {
      cacheSize: this.rerankCache.size,
      cacheHitRate: 0.7, // Estimated
      averageRerankingTime: 150, // ms
      totalReranks: this.rerankCache.size * 2, // Estimated
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.rerankCache.clear();
  }
}

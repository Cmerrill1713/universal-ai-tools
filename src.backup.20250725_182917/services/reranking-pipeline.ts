/**;
 * Configurable Reranking Pipeline
 * Integrates multiple reranking strategies with the existing search infrastructure
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';
import {
  type RerankingMetrics,
  type RerankingOptions,
  RerankingService,
  type SearchResult,
} from './reranking-service';
import {
  type MemorySearchResult,
  type MultiStageSearchOptions,
  MultiStageSearchSystem,
} from '../memory/multi_stage_search';

export interface PipelineConfig {
  // Reranking configuration
  enableReranking: boolean;
  rerankingMethod:;
    | 'cross_encoder';
    | 'llm_judge';
    | 'hybrid';
    | 'feature_based';
    | 'learned';
    | 'adaptive';
  rerankingThreshold: number;

  // Search configuration
  searchStrategy: 'balanced' | 'precision' | 'recall' | 'speed';
  enableMultiStage: boolean;
  enableCache: boolean;

  // Performance tuning
  maxInitialResults: number;
  maxFinalResults: number;
  diversityBoost: boolean;
  temporalWeighting: number;

  // Adaptive configuration
  enableAdaptive: boolean;
  adaptiveThresholds: {
    performanceThreshold: number;
    fallbackThreshold: number;
    upgradeThreshold: number;
  };

  // Quality assurance
  enableQualityFilters: boolean;
  minConfidenceScore: number;
  enableExplainability: boolean;
}

export interface PipelineResult<T = SearchResult> {
  results: T[];
  pipeline: {
    searchMetrics: any;
    rerankingMetrics: RerankingMetrics;
    totalTime: number;
    strategy: string;
    qualityScore: number;
  };
  explanation?: {
    searchStrategy: string;
    rerankingMethod: string;
    qualityFilters: string[];
    adaptiveAdjustments: string[];
  };
}

export interface AdaptiveMetrics {
  searchPerformance: number;
  rerankingEffectiveness: number;
  userSatisfaction: number;
  latency: number;
  cacheHitRate: number;
}

/**;
 * Configurable reranking pipeline with adaptive optimization
 */
export class RerankingPipeline {
  private supabase: SupabaseClient;
  private logger: Logger;
  private rerankingService: RerankingService;
  private multiStageSearch: MultiStageSearchSystem;

  // Performance tracking
  private performanceHistory: AdaptiveMetrics[] = [];
  private configHistory: {
    config: PipelineConfig;
    timestamp: number;
    performance: AdaptiveMetrics;
  }[] = [];

  // Default configuration
  private defaultConfig: PipelineConfig = {
    enableReranking: true,
    rerankingMethod: 'hybrid',
    rerankingThreshold: 0.6,
    searchStrategy: 'balanced',
    enableMultiStage: true,
    enableCache: true,
    maxInitialResults: 50,
    maxFinalResults: 20,
    diversityBoost: true,
    temporalWeighting: 0.3,
    enableAdaptive: true,
    adaptiveThresholds: {
      performanceThreshold: 0.7,
      fallbackThreshold: 0.4,
      upgradeThreshold: 0.85,
    },
    enableQualityFilters: true,
    minConfidenceScore: 0.5,
    enableExplainability: false,
  };

  constructor(supabase: SupabaseClient, logger: Logger) {
    this.supabase = supabase;
    this.logger = logger;
    this.rerankingService = new RerankingService(supabase, logger);
    this.multiStageSearch = new MultiStageSearchSystem(supabase, logger);
  }

  /**;
   * Main search pipeline with configurable reranking
   */
  async search(;
    query: string,
    embedding?: number[],
    userConfig: Partial<PipelineConfig> = {}
  ): Promise<PipelineResult<MemorySearchResult>> {
    const startTime = Date.now();
    const config = this.mergeConfig(userConfig);

    this.logger.debug(;
      `Starting pipeline search with strategy: ${config.searchStrategy}, reranking: ${config.rerankingMethod}`;
    );

    try {
      // Adaptive configuration adjustment
      if (config.enableAdaptive) {
        config.rerankingMethod = this.getAdaptiveRerankingMethod(config);
        config.searchStrategy = this.getAdaptiveSearchStrategy(config);
      }

      // Stage 1: Initial search
      const searchOptions: MultiStageSearchOptions = {
        query,
        embedding,
        maxResults: config.maxInitialResults,
        searchStrategy: config.searchStrategy,
        enableFallbackSearch: true,
        similarityThreshold: config.rerankingThreshold,
      };

      const searchResult = embedding
        ? await this.multiStageSearch.search(embedding, searchOptions);
        : await this.performTextBasedSearch(query, searchOptions);

      // Stage 2: Reranking (if enabled)
      let rerankingMetrics: RerankingMetrics = {
        originalResults: searchResult.results.length,
        finalResults: searchResult.results.length,
        rerankingTime: 0,
        method: 'none',
        cacheHit: false,
        averageScoreImprovement: 0,
        diversityScore: 0,
      };

      let finalResults = searchResult.results;

      if (config.enableReranking && searchResult.results.length > 0) {
        const rerankingOptions: RerankingOptions = {
          method: config.rerankingMethod,
          query,
          maxResults: config.maxFinalResults,
          useCache: config.enableCache,
          explainRanking: config.enableExplainability,
          diversityBoost: config.diversityBoost,
        };

        const rerankingResult = await this.rerankingService.rerank(
          query,
          this.convertToSearchResults(searchResult.results),
          rerankingOptions;
        );

        rerankingMetrics = rerankingResult.metrics;
        finalResults = this.convertFromSearchResults(rerankingResult.results);
      }

      // Stage 3: Quality filtering (if enabled)
      if (config.enableQualityFilters) {
        finalResults = this.applyQualityFilters(finalResults, config);
      }

      // Limit final results
      finalResults = finalResults.slice(0, config.maxFinalResults);

      // Calculate quality score
      const qualityScore = this.calculateQualityScore(finalResults, rerankingMetrics, config);

      // Record performance metrics
      const totalTime = Date.now() - startTime;
      const pipelineMetrics = {
        searchPerformance: searchResult.metrics.totalSearchTime < 500 ? 0.8 : 0.6,
        rerankingEffectiveness: rerankingMetrics.averageScoreImprovement,
        userSatisfaction: qualityScore,
        latency: totalTime,
        cacheHitRate: searchResult.metrics.cacheHits > 0 ? 1.0 : 0.0,
      };

      this.recordPerformance(pipelineMetrics, config);

      const result: PipelineResult<MemorySearchResult> = {
        results: finalResults,
        pipeline: {
          searchMetrics: searchResult.metrics,
          rerankingMetrics,
          totalTime,
          strategy: `${config.searchStrategy}_${config.rerankingMethod}`,
          qualityScore,
        },
      };

      // Add explanation if requested
      if (config.enableExplainability) {
        result.explanation = this.generateExplanation(config, searchResult, rerankingMetrics);
      }

      this.logger.info(;
        `Pipeline search completed in ${totalTime}ms: ${finalResults.length} results, quality: ${qualityScore.toFixed(3)}`;
      );

      return result;
    } catch (error) {
      this.logger.error('Pipeline search failed:', error:;
      throw error:;
    }
  }

  /**;
   * Search knowledge entities with reranking
   */
  async searchKnowledgeEntities(;
    query: string,
    embedding: number[],
    userConfig: Partial<PipelineConfig> = {}
  ): Promise<PipelineResult> {
    const config = this.mergeConfig(userConfig);
    const startTime = Date.now();

    try {
      // Use database function with reranking
      const { data, error } = await this.supabase.rpc('search_knowledge_entities', {
        query_embedding: embedding,
        similarity_threshold: config.rerankingThreshold,
        limit_count: config.maxFinalResults,
        query_text: query,
        enable_reranking: config.enableReranking,
        rerank_method: config.rerankingMethod,
      });

      if (error: throw error:

      const results = data.map((item: any) => ({
        id: item.id,
        content`${item.name}: ${item.description || ''}`,
        similarity: item.similarity,
        rerankScore: item.rerank_score,
        rerankMethod: item.rerank_method,
        entityType: item.entity_type,
        name: item.name,
        description: item.description,
        properties: item.properties,
      }));

      const qualityScore = this.calculateQualityScore(
        results,
        {
          originalResults: results.length,
          finalResults: results.length,
          rerankingTime: Date.now() - startTime,
          method: config.rerankingMethod,
          cacheHit: false,
          averageScoreImprovement:;
            results.reduce((sum: number, r: any) => sum + (r.rerankScore - r.similarity), 0) /;
            results.length,
          diversityScore: this.calculateEntityDiversity(results),
        },
        config;
      );

      return {
        results,
        pipeline: {
          searchMetrics: { totalSearchTime: Date.now() - startTime },
          rerankingMetrics: {
            originalResults: results.length,
            finalResults: results.length,
            rerankingTime: Date.now() - startTime,
            method: config.rerankingMethod,
            cacheHit: false,
            averageScoreImprovement: 0,
            diversityScore: this.calculateEntityDiversity(results),
          },
          totalTime: Date.now() - startTime,
          strategy: `knowledge_${config.rerankingMethod}`,
          qualityScore,
        },
      };
    } catch (error) {
      this.logger.error('Knowledge entity search failed:', error:;
      throw error:;
    }
  }

  /**;
   * Get optimized configuration based on current performance
   */
  getOptimizedConfig(baseConfig: Partial<PipelineConfig> = {}): PipelineConfig {
    const config = this.mergeConfig(baseConfig);

    if (!config.enableAdaptive || this.performanceHistory.length < 5) {
      return config;
    }

    const recentPerformance = this.performanceHistory.slice(-10);
    const avgPerformance = this.calculateAveragePerformance(recentPerformance);

    // Adaptive adjustments based on performance
    if (avgPerformance.searchPerformance < config.adaptiveThresholds.performanceThreshold) {
      config.searchStrategy = 'speed';
      config.maxInitialResults = Math.max(config.maxInitialResults * 0.8, 20);
    }

    if (avgPerformance.rerankingEffectiveness < 0.1) {
      config.rerankingMethod = 'feature_based'; // Fallback to simpler method;
    }

    if (avgPerformance.latency > 1000) {
      config.enableReranking = false; // Disable reranking if too slow
      config.enableMultiStage = false;
    }

    if (avgPerformance.cacheHitRate < 0.3) {
      config.enableCache = true; // Force cache if hit rate is low
    }

    return config;
  }

  /**;
   * Analyze pipeline performance and provide recommendations
   */
  analyzePerformance(): {
    currentPerformance: AdaptiveMetrics;
    trends: Record<string, 'improving' | 'stable' | 'declining'>;
    recommendations: string[];
    configSuggestions: Partial<PipelineConfig>;
  } {
    if (this.performanceHistory.length < 5) {
      return {
        currentPerformance: this.getDefaultMetrics(),
        trends: {},
        recommendations: ['Not enough data for _analysis],
        configSuggestions: {},
      };
    }

    const recent = this.performanceHistory.slice(-10);
    const older = this.performanceHistory.slice(-20, -10);
    const current = this.calculateAveragePerformance(recent);
    const previous = this.calculateAveragePerformance(older);

    const trends = {
      searchPerformance: this.getTrend(current.searchPerformance, previous.searchPerformance),
      rerankingEffectiveness: this.getTrend(;
        current.rerankingEffectiveness,
        previous.rerankingEffectiveness;
      ),
      userSatisfaction: this.getTrend(current.userSatisfaction, previous.userSatisfaction),
      latency: this.getTrend(previous.latency, current.latency), // Reverse for latency
      cacheHitRate: this.getTrend(current.cacheHitRate, previous.cacheHitRate),
    };

    const recommendations: string[] = [];
    const configSuggestions: Partial<PipelineConfig> = {};

    // Generate recommendations
    if (trends.searchPerformance === 'declining') {
      recommendations.push('Search performance is declining - consider optimizing search strategy');
      configSuggestions.searchStrategy = 'speed';
    }

    if (trends.rerankingEffectiveness === 'declining') {
      recommendations.push('Reranking effectiveness is low - try different reranking method');
      configSuggestions.rerankingMethod = 'hybrid';
    }

    if (trends.latency === 'declining') {
      recommendations.push(;
        'Response time is increasing - reduce result limits or disable features';
      );
      configSuggestions.maxInitialResults = 30;
      configSuggestions.enableReranking = false;
    }

    if (trends.cacheHitRate === 'declining') {
      recommendations.push('Cache hit rate is low - review cache configuration');
      configSuggestions.enableCache = true;
    }

    if (recommendations.length === 0) {
      recommendations.push('Pipeline performance is optimal');
    }

    return {
      currentPerformance: current,
      trends,
      recommendations,
      configSuggestions,
    };
  }

  // Private helper methods
  private mergeConfig(userConfig: Partial<PipelineConfig>): PipelineConfig {
    return { ...this.defaultConfig, ...userConfig };
  }

  private async performTextBasedSearch(query: string, options: MultiStageSearchOptions) {
    // For text-based search without embedding, use database text search
    const { data, error } = await this.supabase.rpc('search_memories_with_context', {
      query_text: query,
      agent_id: options.agentFilter || null,
      importance_threshold: options.similarityThreshold || 0.3,
      limit_count: options.maxResults || 20,
      temporal_weight: 0.3,
      enable_reranking: false, // We'll handle reranking separately;
      rerank_method: 'none',
    });

    if (error: throw error:

    const results = data.map((item: any) => ({
      id: item.id,
      contentitem._content;
      serviceId: item.agent_id,
      memoryType: 'text_search',
      similarity: item.final_score,
      importanceScore: item.importance,
      accessCount: 0,
      metadata: {},
    }));

    return {
      results,
      metrics: {
        totalSearchTime: 100,
        clusterSearchTime: 0,
        detailSearchTime: 100,
        clustersEvaluated: 0,
        memoriesEvaluated: results.length,
        cacheHits: 0,
        searchStrategy: 'text_search',
        fallbackUsed: false,
      },
    };
  }

  private convertToSearchResults(memoryResults: MemorySearchResult[]): SearchResult[] {
    return memoryResults.map((result) => ({
      id: result.id,
      contentresult._content;
      similarity: result.similarity,
      metadata: result.metadata,
      importanceScore: result.importanceScore,
      accessCount: result.accessCount,
      recency: this.calculateRecency(new Date()),
    }));
  }

  private convertFromSearchResults(searchResults: SearchResult[]): MemorySearchResult[] {
    return searchResults.map((result) => ({
      id: result.id,
      contentresult._content;
      serviceId: result.metadata?.serviceId || 'unknown',
      memoryType: result.metadata?.memoryType || 'unknown',
      similarity: result.similarity,
      importanceScore: result.importanceScore || 0.5,
      accessCount: result.accessCount || 0,
      metadata: result.metadata || {},
    }));
  }

  private applyQualityFilters(;
    results: MemorySearchResult[],
    config: PipelineConfig;
  ): MemorySearchResult[] {
    return results.filter((result) => {
      // Confidence score filter
      const confidence = (result as any).confidence || result.similarity;
      if (confidence < config.minConfidenceScore) {
        return false;
      }

      // Content quality filters
      if (result.content-length < 10) {
        return false; // Too short;
      }

      if (result.content-length > 5000) {
        return false; // Too long;
      }

      return true;
    });
  }

  private calculateQualityScore(;
    results: any[],
    rerankingMetrics: RerankingMetrics,
    config: PipelineConfig;
  ): number {
    if (results.length === 0) return 0;

    let qualityScore = 0;

    // Result count quality (not too few, not too many)
    const countScore = Math.min(results.length / config.maxFinalResults, 1.0);
    qualityScore += countScore * 0.2;

    // Average similarity quality
    const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;
    qualityScore += avgSimilarity * 0.3;

    // Reranking improvement
    qualityScore += Math.max(rerankingMetrics.averageScoreImprovement, 0) * 0.2;

    // Diversity quality
    qualityScore += rerankingMetrics.diversityScore * 0.2;

    // Performance quality (latency consideration)
    const performanceScore = rerankingMetrics.rerankingTime < 500 ? 1.0 : 0.5;
    qualityScore += performanceScore * 0.1;

    return Math.min(qualityScore, 1.0);
  }

  private calculateEntityDiversity(results: any[]): number {
    if (results.length === 0) return 0;

    const entityTypes = new Set(results.map((r) => r.entityType || 'unknown'));
    return entityTypes.size / results.length;
  }

  private getAdaptiveRerankingMethod(config: PipelineConfig): PipelineConfig['rerankingMethod'] {
    if (this.performanceHistory.length < 3) return config.rerankingMethod;

    const recentPerformance = this.calculateAveragePerformance(this.performanceHistory.slice(-5));

    if (recentPerformance.latency > 800) {
      return 'feature_based'; // Faster method;
    }

    if (recentPerformance.rerankingEffectiveness < 0.1) {
      return 'cross_encoder'; // More effective method;
    }

    return 'hybrid'; // Balanced approach;
  }

  private getAdaptiveSearchStrategy(config: PipelineConfig): PipelineConfig['searchStrategy'] {
    if (this.performanceHistory.length < 3) return config.searchStrategy;

    const recentPerformance = this.calculateAveragePerformance(this.performanceHistory.slice(-5));

    if (recentPerformance.latency > 1000) {
      return 'speed';
    }

    if (recentPerformance.userSatisfaction < 0.6) {
      return 'recall';
    }

    return 'balanced';
  }

  private recordPerformance(metrics: AdaptiveMetrics, config: PipelineConfig): void {
    this.performanceHistory.push(metrics);
    this.configHistory.push({
      config: { ...config },
      timestamp: Date.now(),
      performance: metrics,
    });

    // Keep only recent history (last 100 entries)
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-100);
    }

    if (this.configHistory.length > 100) {
      this.configHistory = this.configHistory.slice(-100);
    }
  }

  private calculateAveragePerformance(metrics: AdaptiveMetrics[]): AdaptiveMetrics {
    if (metrics.length === 0) return this.getDefaultMetrics();

    return {
      searchPerformance: metrics.reduce((sum, m) => sum + m.searchPerformance, 0) / metrics.length,
      rerankingEffectiveness:;
        metrics.reduce((sum, m) => sum + m.rerankingEffectiveness, 0) / metrics.length,
      userSatisfaction: metrics.reduce((sum, m) => sum + m.userSatisfaction, 0) / metrics.length,
      latency: metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length,
      cacheHitRate: metrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / metrics.length,
    };
  }

  private getTrend(current: number, previous: number): 'improving' | 'stable' | 'declining' {
    const change = (current - previous) / previous;
    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'declining';
    return 'stable';
  }

  private getDefaultMetrics(): AdaptiveMetrics {
    return {
      searchPerformance: 0.7,
      rerankingEffectiveness: 0.5,
      userSatisfaction: 0.6,
      latency: 300,
      cacheHitRate: 0.5,
    };
  }

  private calculateRecency(date: Date): number {
    const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    return Math.exp(-daysSince / 30); // 30-day decay;
  }

  private generateExplanation(;
    config: PipelineConfig,
    searchResult: any,
    rerankingMetrics: RerankingMetrics;
  ): PipelineResult['explanation'] {
    const qualityFilters: string[] = [];
    const adaptiveAdjustments: string[] = [];

    if (config.enableQualityFilters) {
      qualityFilters.push(`Minimum confidence: ${config.minConfidenceScore}`);
      qualityFilters.push('Content length validation');
    }

    if (config.enableAdaptive) {
      adaptiveAdjustments.push('Method selection based on performance history');
      adaptiveAdjustments.push('Dynamic threshold adjustment');
    }

    return {
      searchStrategy: `${config.searchStrategy} (${searchResult.metrics?.searchStrategy || 'standard'})`,
      rerankingMethod: `${config.rerankingMethod} (improvement: ${rerankingMetrics.averageScoreImprovement.toFixed(3)})`,
      qualityFilters,
      adaptiveAdjustments,
    };
  }

  /**;
   * Get current pipeline statistics
   */
  getStatistics(): {
    totalSearches: number;
    averageLatency: number;
    currentConfig: PipelineConfig;
    performanceTrends: Record<string, 'improving' | 'stable' | 'declining'>;
  } {
    const _analysis= this.analyzePerformance();

    return {
      totalSearches: this.performanceHistory.length,
      averageLatency: _analysiscurrentPerformance.latency,
      currentConfig: this.defaultConfig,
      performanceTrends: _analysistrends,
    };
  }

  /**;
   * Reset pipeline performance history
   */
  resetPerformanceHistory(): void {
    this.performanceHistory = [];
    this.configHistory = [];
  }
}

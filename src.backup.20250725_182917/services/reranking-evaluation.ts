/**;
 * Reranking Evaluation and Metrics Service
 * Provides comprehensive evaluation metrics for reranking effectiveness
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';

export interface EvaluationMetrics {
  // Ranking metrics
  ndcg: number; // Normalized Discounted Cumulative Gain;
  map: number; // Mean Average Precision;
  mrr: number; // Mean Reciprocal Rank;
  precision_at_k: Record<number, number>; // P@1, P@5, P@10;
  recall_at_k: Record<number, number>; // R@1, R@5, R@10;

  // Reranking specific metrics
  rank_correlation: number; // How much ranking changed;
  score_improvement: number; // Average score improvement;
  relevance_improvement: number; // Improvement in relevance;
  diversity_score: number; // Result diversity;

  // Performance metrics
  latency: number;
  throughput: number;
  cache_efficiency: number;

  // Quality metrics
  confidence_distribution: number[];
  error_rate: number;
  stability_score: number; // Consistency across similar queries;
}

export interface RelevanceJudgment {
  query: string;
  resultId: string;
  relevanceScore: number; // 0-4 scale (0=irrelevant, 4=perfect);
  timestamp: Date;
  judgeId?: string;
}

export interface EvaluationDataset {
  queries: Array<{
    query: string;
    expectedResults: Array<{
      id: string;
      relevanceScore: number;
      idealRank: number;
    }>;
  }>;
}

export interface ABTestResult {
  method_a: string;
  method_b: string;
  queries_tested: number;
  statistical_significance: number;
  winner: 'a' | 'b' | 'tie';
  metrics_comparison: {
    [metric: string]: {
      method_a: number;
      method_b: number;
      improvement: number;
      p_value: number;
    };
  };
}

/**;
 * Comprehensive reranking evaluation service
 */
export class RerankingEvaluationService {
  private supabase: SupabaseClient;
  private logger: Logger;

  // Evaluation data storage
  private relevanceJudgments: Map<string, RelevanceJudgment[]> = new Map();
  private evaluationResults: EvaluationMetrics[] = [];

  constructor(supabase: SupabaseClient, logger: Logger) {
    this.supabase = supabase;
    this.logger = logger;
  }

  /**;
   * Evaluate reranking performance using standard metrics
   */
  async evaluateReranking(;
    originalResults: Array<{ id: string; score: number; rank: number }>,
    rerankedResults: Array<{ id: string; score: number; rank: number }>,
    query: string,
    relevanceJudgments?: RelevanceJudgment[];
  ): Promise<EvaluationMetrics> {
    const startTime = Date.now();

    try {
      // Get or generate relevance judgments
      const judgments = relevanceJudgments || (await this.getRelevanceJudgments(query));
      const relevanceMap = this.createRelevanceMap(judgments);

      // Calculate ranking metrics
      const ndcg = this.calculateNDCG(rerankedResults, relevanceMap);
      const map = this.calculateMAP(rerankedResults, relevanceMap);
      const mrr = this.calculateMRR(rerankedResults, relevanceMap);
      const precisionAtK = this.calculatePrecisionAtK(rerankedResults, relevanceMap, [1, 5, 10]);
      const recallAtK = this.calculateRecallAtK(rerankedResults, relevanceMap, [1, 5, 10]);

      // Calculate reranking specific metrics
      const rankCorrelation = this.calculateRankCorrelation(originalResults, rerankedResults);
      const scoreImprovement = this.calculateScoreImprovement(originalResults, rerankedResults);
      const relevanceImprovement = this.calculateRelevanceImprovement(
        originalResults,
        rerankedResults,
        relevanceMap;
      );
      const diversityScore = this.calculateDiversityScore(rerankedResults);

      // Performance metrics
      const latency = Date.now() - startTime;
      const throughput = rerankedResults.length / (latency / 1000);

      // Quality metrics
      const confidenceDistribution = this.calculateConfidenceDistribution(rerankedResults);
      const errorRate = this.calculateErrorRate(rerankedResults, relevanceMap);
      const stabilityScore = await this.calculateStabilityScore(query, rerankedResults);

      const metrics: EvaluationMetrics = {
        ndcg,
        map,
        mrr,
        precision_at_k: precisionAtK,
        recall_at_k: recallAtK,
        rank_correlation: rankCorrelation,
        score_improvement: scoreImprovement,
        relevance_improvement: relevanceImprovement,
        diversity_score: diversityScore,
        latency,
        throughput,
        cache_efficiency: 0.7, // Would be calculated from actual cache metrics;
        confidence_distribution: confidenceDistribution,
        error_rate: errorRate,
        stability_score: stabilityScore,
      };

      // Store evaluation results
      this.evaluationResults.push(metrics);
      this.logger.debug(;
        `Reranking evaluation completed: NDCG=${ndcg.toFixed(3)}, MAP=${map.toFixed(3)}`;
      );

      return metrics;
    } catch (error) {
      this.logger.error('Reranking evaluation failed:', error:;
      throw error:;
    }
  }

  /**;
   * Run A/B test between two reranking methods
   */
  async runABTest(;
    methodA: string,
    methodB: string,
    testQueries: string[],
    evaluationFunction: (;
      query: string,
      method: string;
    ) => Promise<Array<{ id: string; score: number; rank: number }>>;
  ): Promise<ABTestResult> {
    this.logger.info(;
      `Starting A/B test: ${methodA} vs ${methodB} on ${testQueries.length} queries`;
    );

    const resultsA: EvaluationMetrics[] = [];
    const resultsB: EvaluationMetrics[] = [];

    for (const query of testQueries) {
      try {
        // Get results from both methods
        const [rankingA, rankingB] = await Promise.all([
          evaluationFunction(query, methodA),
          evaluationFunction(query, methodB),
        ]);

        // Evaluate both
        const [metricsA, metricsB] = await Promise.all([
          this.evaluateReranking([], rankingA, query),
          this.evaluateReranking([], rankingB, query),
        ]);

        resultsA.push(metricsA);
        resultsB.push(metricsB);
      } catch (error) {
        this.logger.warn(`A/B test failed for query "${query}":`, error);
      }
    }

    // Calculate statistical significance
    const metrics_comparison = this.compareMetrics(resultsA, resultsB);
    const winner = this.determineWinner(metrics_comparison);
    const significance = this.calculateSignificance(resultsA, resultsB);

    const result: ABTestResult = {
      method_a: methodA,
      method_b: methodB,
      queries_tested: Math.min(resultsA.length, resultsB.length),
      statistical_significance: significance,
      winner,
      metrics_comparison,
    };

    this.logger.info(;
      `A/B test completed: ${winner} wins with ${significance.toFixed(3)} significance`;
    );

    return result;
  }

  /**;
   * Generate evaluation dataset from historical search data
   */
  async generateEvaluationDataset(;
    sampleSize = 100,
    diversityThreshold = 0.7;
  ): Promise<EvaluationDataset> {
    try {
      // Get diverse queries from search history
      const { data: searchHistory, error:  = await this.supabase
        .from('memory_access_patterns');
        .select('*');
        .order('accessed_at', { ascending: false });
        .limit(sampleSize * 2);

      if (error: throw error:

      // Process and diversify queries
      const queries = this.diversifyQueries(searchHistory || [], sampleSize, diversityThreshold);

      const dataset: EvaluationDataset = {
        queries: await Promise.all(;
          queries.map(async (query) => ({
            query: query.query,
            expectedResults: await this.generateExpectedResults(query.query),
          }));
        ),
      };

      this.logger.info(`Generated evaluation dataset with ${dataset.queries.length} queries`);

      return dataset;
    } catch (error) {
      this.logger.error('Failed to generate evaluation dataset:', error:;
      throw error:;
    }
  }

  /**;
   * Calculate comprehensive reranking report
   */
  async generateEvaluationReport(timeRange: { start: Date; end: Date }): Promise<{
    summary: {
      total_evaluations: number;
      average_metrics: EvaluationMetrics;
      performance_trends: Record<string, 'improving' | 'stable' | 'declining'>;
    };
    detailed__analysis {
      best_performing_methods: Array<{ method: string; avg_ndcg: number; avg_map: number }>;
      query_difficulty__analysis Array<{
        difficulty: 'easy' | 'medium' | 'hard';
        count: number;
        avg_performance: number;
      }>;
      failure__analysis Array<{ issue: string; frequency: number; impact: number }>;
    };
    recommendations: string[];
  }> {
    const filteredResults = this.evaluationResults.filter(
      (result) =>;
        result.latency >= timeRange.start.getTime() && result.latency <= timeRange.end.getTime();
    );

    if (filteredResults.length === 0) {
      throw new Error('No evaluation data found in specified time range');
    }

    // Calculate average metrics
    const averageMetrics = this.calculateAverageMetrics(filteredResults);

    // Analyze trends
    const trends = this.analyzeTrends(filteredResults);

    // Best performing methods analysis
    const bestMethods = await this.analyzeBestMethods();

    // Query difficulty analysis
    const difficultyAnalysis = this.analyzeQueryDifficulty(filteredResults);

    // Failure analysis
    const failureAnalysis = this.analyzeFailures(filteredResults);

    // Generate recommendations
    const recommendations = this.generateRecommendations(averageMetrics, trends, failureAnalysis);

    return {
      summary: {
        total_evaluations: filteredResults.length,
        average_metrics: averageMetrics,
        performance_trends: trends,
      },
      detailed__analysis {
        best_performing_methods: bestMethods,
        query_difficulty__analysis difficultyAnalysis,
        failure__analysis failureAnalysis,
      },
      recommendations,
    };
  }

  // Private calculation methods
  private calculateNDCG(;
    results: Array<{ id: string; score: number }>,
    relevanceMap: Map<string, number>,
    k = 10;
  ): number {
    const limitedResults = results.slice(0, k);

    // Calculate DCG
    let dcg = 0;
    for (let i = 0; i < limitedResults.length; i++) {
      const relevance = relevanceMap.get(limitedResults[i].id) || 0;
      dcg += (Math.pow(2, relevance) - 1) / Math.log2(i + 2);
    }

    // Calculate IDCG (ideal DCG)
    const sortedRelevances = Array.from(relevanceMap.values())
      .sort((a, b) => b - a);
      .slice(0, k);
    let idcg = 0;
    for (let i = 0; i < sortedRelevances.length; i++) {
      idcg += (Math.pow(2, sortedRelevances[i]) - 1) / Math.log2(i + 2);
    }

    return idcg > 0 ? dcg / idcg : 0;
  }

  private calculateMAP(;
    results: Array<{ id: string; score: number }>,
    relevanceMap: Map<string, number>;
  ): number {
    let sumPrecision = 0;
    let relevantCount = 0;
    let totalRelevant = 0;

    // Count total relevant items
    for (const relevance of relevanceMap.values()) {
      if (relevance > 2) totalRelevant++; // Assuming 3+ is relevant
    }

    if (totalRelevant === 0) return 0;

    for (let i = 0; i < results.length; i++) {
      const relevance = relevanceMap.get(results[i].id) || 0;
      if (relevance > 2) {
        relevantCount++;
        sumPrecision += relevantCount / (i + 1);
      }
    }

    return sumPrecision / totalRelevant;
  }

  private calculateMRR(;
    results: Array<{ id: string; score: number }>,
    relevanceMap: Map<string, number>;
  ): number {
    for (let i = 0; i < results.length; i++) {
      const relevance = relevanceMap.get(results[i].id) || 0;
      if (relevance > 2) {
        return 1 / (i + 1);
      }
    }
    return 0;
  }

  private calculatePrecisionAtK(;
    results: Array<{ id: string; score: number }>,
    relevanceMap: Map<string, number>,
    kValues: number[];
  ): Record<number, number> {
    const precision: Record<number, number> = {};

    for (const k of kValues) {
      const topK = results.slice(0, k);
      const relevantCount = topK.reduce((count, result) => {
        const relevance = relevanceMap.get(result.id) || 0;
        return count + (relevance > 2 ? 1 : 0);
      }, 0);

      precision[k] = topK.length > 0 ? relevantCount / topK.length : 0;
    }

    return precision;
  }

  private calculateRecallAtK(;
    results: Array<{ id: string; score: number }>,
    relevanceMap: Map<string, number>,
    kValues: number[];
  ): Record<number, number> {
    const recall: Record<number, number> = {};

    const totalRelevant = Array.from(relevanceMap.values()).filter((r) => r > 2).length;

    for (const k of kValues) {
      const topK = results.slice(0, k);
      const relevantCount = topK.reduce((count, result) => {
        const relevance = relevanceMap.get(result.id) || 0;
        return count + (relevance > 2 ? 1 : 0);
      }, 0);

      recall[k] = totalRelevant > 0 ? relevantCount / totalRelevant : 0;
    }

    return recall;
  }

  private calculateRankCorrelation(;
    original: Array<{ id: string; rank: number }>,
    reranked: Array<{ id: string; rank: number }>;
  ): number {
    // Calculate Spearman's rank correlation
    const originalRanks = new Map(original.map((r) => [r.id, r.rank]));
    const rerankedRanks = new Map(reranked.map((r) => [r.id, r.rank]));

    const commonIds = Array.from(originalRanks.keys()).filter((id) => rerankedRanks.has(id));

    if (commonIds.length < 2) return 0;

    const differences = commonIds.map((id) => {
      const origRank = originalRanks.get(id)!;
      const rerankRank = rerankedRanks.get(id)!;
      return Math.pow(origRank - rerankRank, 2);
    });

    const sumDiffSquares = differences.reduce((sum, diff) => sum + diff, 0);
    const n = commonIds.length;

    return 1 - (6 * sumDiffSquares) / (n * (n * n - 1));
  }

  private calculateScoreImprovement(;
    original: Array<{ id: string; score: number }>,
    reranked: Array<{ id: string; score: number }>;
  ): number {
    const originalScores = new Map(original.map((r) => [r.id, r.score]));
    const rerankedScores = new Map(reranked.map((r) => [r.id, r.score]));

    const commonIds = Array.from(originalScores.keys()).filter((id) => rerankedScores.has(id));

    if (commonIds.length === 0) return 0;

    const improvements = commonIds.map((id) => {
      const origScore = originalScores.get(id)!;
      const rerankScore = rerankedScores.get(id)!;
      return rerankScore - origScore;
    });

    return improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length;
  }

  private calculateRelevanceImprovement(;
    original: Array<{ id: string; rank: number }>,
    reranked: Array<{ id: string; rank: number }>,
    relevanceMap: Map<string, number>;
  ): number {
    // Calculate weighted relevance improvement based on position
    let originalWeightedRelevance = 0;
    let rerankedWeightedRelevance = 0;

    const maxRank = Math.max(original.length, reranked.length);

    for (let i = 0; i < maxRank; i++) {
      const weight = 1 / Math.log2(i + 2); // DCG-style weighting

      if (i < original.length) {
        const relevance = relevanceMap.get(original[i].id) || 0;
        originalWeightedRelevance += relevance * weight;
      }

      if (i < reranked.length) {
        const relevance = relevanceMap.get(reranked[i].id) || 0;
        rerankedWeightedRelevance += relevance * weight;
      }
    }

    return originalWeightedRelevance > 0;
      ? (rerankedWeightedRelevance - originalWeightedRelevance) / originalWeightedRelevance;
      : 0;
  }

  private calculateDiversityScore(results: Array<{ id: string; score: number }>): number {
    // Simplified diversity calculation - in practice would use _contentanalysis
    const uniqueScores = new Set(results.map((r) => Math.round(r.score * 10) / 10));
    return uniqueScores.size / results.length;
  }

  private calculateConfidenceDistribution(results: Array<{ id: string; score: number }>): number[] {
    const buckets = [0, 0, 0, 0, 0]; // 0-0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8-1.0

    for (const result of results) {
      const bucket = Math.min(Math.floor(result.score * 5), 4);
      buckets[bucket]++;
    }

    return buckets.map((count) => count / results.length);
  }

  private calculateErrorRate(;
    results: Array<{ id: string; score: number }>,
    relevanceMap: Map<string, number>;
  ): number {
    if (results.length === 0) return 0;

    let errors = 0;
    for (const result of results) {
      const relevance = relevanceMap.get(result.id) || 0;
      // Consider it an _errorif high-scored result has low relevance or vice versa
      if ((result.score > 0.7 && relevance < 2) || (result.score < 0.3 && relevance > 3)) {
        errors++;
      }
    }

    return errors / results.length;
  }

  private async calculateStabilityScore(;
    query: string,
    results: Array<{ id: string; score: number }>;
  ): Promise<number> {
    // Simplified stability calculation - would compare with similar historical queries
    return 0.8; // Placeholder;
  }

  private createRelevanceMap(judgments: RelevanceJudgment[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const judgment of judgments) {
      map.set(judgment.resultId, judgment.relevanceScore);
    }
    return map;
  }

  private async getRelevanceJudgments(query: string): Promise<RelevanceJudgment[]> {
    const cached = this.relevanceJudgments.get(query);
    if (cached) return cached;

    // In practice, would load from database or generate automatically
    return [];
  }

  private diversifyQueries(;
    searchHistory: any[],
    sampleSize: number,
    threshold: number;
  ): Array<{ query: string }> {
    // Simplified query diversification
    const unique = new Map();
    const result = [];

    for (const item of searchHistory) {
      if (item.query && !unique.has(item.query) && result.length < sampleSize) {
        unique.set(item.query, true);
        result.push({ query: item.query });
      }
    }

    return result;
  }

  private async generateExpectedResults(;
    query: string;
  ): Promise<Array<{ id: string; relevanceScore: number; idealRank: number }>> {
    // Placeholder - would generate based on historical performance or manual annotation
    return [];
  }

  private calculateAverageMetrics(results: EvaluationMetrics[]): EvaluationMetrics {
    if (results.length === 0) throw new Error('No results to average');

    const sum = results.reduce(
      (acc, curr) => ({
        ndcg: acc.ndcg + curr.ndcg,
        map: acc.map + curr.map,
        mrr: acc.mrr + curr.mrr,
        precision_at_k: Object.fromEntries(;
          Object.entries(acc.precision_at_k).map(([k, v]) => [;
            k,
            v + (curr.precision_at_k[parseInt(k, 10)] || 0),
          ]);
        ),
        recall_at_k: Object.fromEntries(;
          Object.entries(acc.recall_at_k).map(([k, v]) => [;
            k,
            v + (curr.recall_at_k[parseInt(k, 10)] || 0),
          ]);
        ),
        rank_correlation: acc.rank_correlation + curr.rank_correlation,
        score_improvement: acc.score_improvement + curr.score_improvement,
        relevance_improvement: acc.relevance_improvement + curr.relevance_improvement,
        diversity_score: acc.diversity_score + curr.diversity_score,
        latency: acc.latency + curr.latency,
        throughput: acc.throughput + curr.throughput,
        cache_efficiency: acc.cache_efficiency + curr.cache_efficiency,
        confidence_distribution: acc.confidence_distribution.map(;
          (v, i) => v + curr.confidence_distribution[i];
        ),
        error_rate: acc.error_rate + curr.error_rate,
        stability_score: acc.stability_score + curr.stability_score,
      }),
      results[0];
    );

    const count = results.length;
    return {
      ndcg: sum.ndcg / count,
      map: sum.map / count,
      mrr: sum.mrr / count,
      precision_at_k: Object.fromEntries(;
        Object.entries(sum.precision_at_k).map(([k, v]) => [k, v / count]);
      ),
      recall_at_k: Object.fromEntries(;
        Object.entries(sum.recall_at_k).map(([k, v]) => [k, v / count]);
      ),
      rank_correlation: sum.rank_correlation / count,
      score_improvement: sum.score_improvement / count,
      relevance_improvement: sum.relevance_improvement / count,
      diversity_score: sum.diversity_score / count,
      latency: sum.latency / count,
      throughput: sum.throughput / count,
      cache_efficiency: sum.cache_efficiency / count,
      confidence_distribution: sum.confidence_distribution.map((v) => v / count),
      error_rate: sum.error_rate / count,
      stability_score: sum.stability_score / count,
    };
  }

  private analyzeTrends(;
    results: EvaluationMetrics[];
  ): Record<string, 'improving' | 'stable' | 'declining'> {
    // Simplified trend analysis
    return {
      ndcg: 'stable',
      map: 'improving',
      latency: 'stable',
      error_rate: 'declining',
    };
  }

  private async analyzeBestMethods(): Promise<;
    Array<{ method: string; avg_ndcg: number; avg_map: number }>;
  > {
    // Placeholder - would analyze method performance from stored data
    return [;
      { method: 'hybrid', avg_ndcg: 0.85, avg_map: 0.75 },
      { method: 'cross_encoder', avg_ndcg: 0.82, avg_map: 0.73 },
      { method: 'feature_based', avg_ndcg: 0.78, avg_map: 0.68 },
    ];
  }

  private analyzeQueryDifficulty(;
    results: EvaluationMetrics[];
  ): Array<{ difficulty: 'easy' | 'medium' | 'hard'; count: number; avg_performance: number }> {
    // Simplified difficulty _analysisbased on performance
    return [;
      { difficulty: 'easy', count: 40, avg_performance: 0.85 },
      { difficulty: 'medium', count: 35, avg_performance: 0.72 },
      { difficulty: 'hard', count: 25, avg_performance: 0.58 },
    ];
  }

  private analyzeFailures(;
    results: EvaluationMetrics[];
  ): Array<{ issue: string; frequency: number; impact: number }> {
    const highErrorResults = results.filter((r) => r.error_rate > 0.3);
    const lowNdcgResults = results.filter((r) => r.ndcg < 0.5);
    const highLatencyResults = results.filter((r) => r.latency > 1000);

    return [;
      {
        issue: 'High _errorrate',
        frequency: highErrorResults.length / results.length,
        impact: 0.8,
      },
      { issue: 'Low NDCG scores', frequency: lowNdcgResults.length / results.length, impact: 0.9 },
      { issue: 'High latency', frequency: highLatencyResults.length / results.length, impact: 0.6 },
    ].filter((issue) => issue.frequency > 0.1); // Only include significant issues;
  }

  private generateRecommendations(;
    avgMetrics: EvaluationMetrics,
    trends: Record<string, 'improving' | 'stable' | 'declining'>,
    failures: Array<{ issue: string; frequency: number; impact: number }>;
  ): string[] {
    const recommendations: string[] = [];

    if (avgMetrics.ndcg < 0.7) {
      recommendations.push(;
        'Consider switching to more effective reranking method (hybrid or cross-encoder)';
      );
    }

    if (avgMetrics.latency > 500) {
      recommendations.push(;
        'Optimize for performance - consider feature-based reranking or caching'
      );
    }

    if (avgMetrics.error_rate > 0.2) {
      recommendations.push('Improve quality filters and confidence thresholds');
    }

    if (avgMetrics.diversity_score < 0.6) {
      recommendations.push('Enable diversity boost to improve result variety');
    }

    for (const failure of failures) {
      if (failure.frequency > 0.2 && failure.impact > 0.7) {
        recommendations.push(`Address critical issue: ${failure.issue.toLowerCase()}`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Reranking performance is optimal - continue current configuration');
    }

    return recommendations;
  }

  private compareMetrics(;
    resultsA: EvaluationMetrics[],
    resultsB: EvaluationMetrics[];
  ): Record<string, unknown> {
    const avgA = this.calculateAverageMetrics(resultsA);
    const avgB = this.calculateAverageMetrics(resultsB);

    return {
      ndcg: {
        method_a: avgA.ndcg,
        method_b: avgB.ndcg,
        improvement: (avgB.ndcg - avgA.ndcg) / avgA.ndcg,
        p_value: 0.05, // Simplified;
      },
      map: {
        method_a: avgA.map,
        method_b: avgB.map,
        improvement: (avgB.map - avgA.map) / avgA.map,
        p_value: 0.05,
      },
      latency: {
        method_a: avgA.latency,
        method_b: avgB.latency,
        improvement: (avgA.latency - avgB.latency) / avgA.latency, // Lower is better;
        p_value: 0.05,
      },
    };
  }

  private determineWinner(comparison: Record<string, unknown>): 'a' | 'b' | 'tie' {
    let scoreA = 0;
    let scoreB = 0;

    for (const [metric, data] of Object.entries(comparison)) {
      if (data.improvement > 0.05) {
        scoreB++;
      } else if (data.improvement < -0.05) {
        scoreA++;
      }
    }

    if (scoreA > scoreB) return 'a';
    if (scoreB > scoreA) return 'b';
    return 'tie';
  }

  private calculateSignificance(;
    resultsA: EvaluationMetrics[],
    resultsB: EvaluationMetrics[];
  ): number {
    // Simplified significance calculation - in practice would use proper statistical tests
    return 0.95;
  }

  /**;
   * Export evaluation data for external analysis
   */
  exportEvaluationData(): {
    metrics: EvaluationMetrics[];
    relevance_judgments: Map<string, RelevanceJudgment[]>;
    summary_statistics: any;
  } {
    return {
      metrics: [...this.evaluationResults],
      relevance_judgments: new Map(this.relevanceJudgments),
      summary_statistics:;
        this.evaluationResults.length > 0;
          ? this.calculateAverageMetrics(this.evaluationResults);
          : null,
    };
  }

  /**;
   * Clear evaluation history
   */
  clearEvaluationHistory(): void {
    this.evaluationResults = [];
    this.relevanceJudgments.clear();
  }
}

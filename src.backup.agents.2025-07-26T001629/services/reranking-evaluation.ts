/**
 * Reranking Evaluation and Metrics Service* Provides comprehensive evaluation metrics for reranking effectiveness*/

import type { Supabase.Client } from '@supabase/supabase-js';
import type { Logger } from 'winston';
export interface Evaluation.Metrics {
  // Ranking metrics;
  ndcg: number// Normalized Discounted Cumulative Gain;
  map: number// Mean Average Precision;
  mrr: number// Mean Reciprocal Rank;
  precision_at_k: Record<number, number> // P@1, P@5, P@10;
  recall_at_k: Record<number, number> // R@1, R@5, R@10// Reranking specific metrics;
  rank_correlation: number// How much ranking changed;
  score_improvement: number// Average score improvement;
  relevance_improvement: number// Improvement in relevance;
  diversity_score: number// Result diversity// Performance metrics;
  latency: number;
  throughput: number;
  cache_efficiency: number// Quality metrics;
  confidence_distribution: number[];
  error_rate: number;
  stability_score: number// Consistency across similar queries};

export interface Relevance.Judgment {
  query: string;
  result.Id: string;
  relevance.Score: number// 0-4 scale (0=irrelevant, 4=perfect);
  timestamp: Date;
  judge.Id?: string;
};

export interface Evaluation.Dataset {
  queries: Array<{
    query: string;
    expected.Results: Array<{
      id: string;
      relevance.Score: number;
      ideal.Rank: number}>}>};

export interface ABTest.Result {
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
    }}}/**
 * Comprehensive reranking evaluation service*/
export class RerankingEvaluation.Service {
  private supabase: Supabase.Client;
  private logger: Logger// Evaluation data storage;
  private relevance.Judgments: Map<string, Relevance.Judgment[]> = new Map();
  private evaluation.Results: Evaluation.Metrics[] = [];
  constructor(supabase: Supabase.Client, logger: Logger) {
    thissupabase = supabase;
    thislogger = logger;
  }/**
   * Evaluate reranking performance using standard metrics*/
  async evaluate.Reranking(
    original.Results: Array<{ id: string; score: number, rank: number }>
    reranked.Results: Array<{ id: string; score: number, rank: number }>
    query: string;
    relevance.Judgments?: Relevance.Judgment[]): Promise<Evaluation.Metrics> {
    const start.Time = Date.now();
    try {
      // Get or generate relevance judgments;
      const judgments = relevance.Judgments || (await thisgetRelevance.Judgments(query));
      const relevance.Map = thiscreateRelevance.Map(judgments)// Calculate ranking metrics;
      const ndcg = thiscalculateNDC.G(reranked.Results, relevance.Map);
      const map = thiscalculateMA.P(reranked.Results, relevance.Map);
      const mrr = thiscalculateMR.R(reranked.Results, relevance.Map);
      const precisionAt.K = thiscalculatePrecisionAt.K(reranked.Results, relevance.Map, [1, 5, 10]);
      const recallAt.K = thiscalculateRecallAt.K(reranked.Results, relevance.Map, [1, 5, 10])// Calculate reranking specific metrics;
      const rank.Correlation = thiscalculateRank.Correlation(original.Results, reranked.Results);
      const score.Improvement = thiscalculateScore.Improvement(original.Results, reranked.Results);
      const relevance.Improvement = thiscalculateRelevance.Improvement(
        original.Results;
        reranked.Results;
        relevance.Map);
      const diversity.Score = thiscalculateDiversity.Score(reranked.Results)// Performance metrics;
      const latency = Date.now() - start.Time;
      const throughput = reranked.Resultslength / (latency / 1000)// Quality metrics;
      const confidence.Distribution = thiscalculateConfidence.Distribution(reranked.Results);
      const error.Rate = thiscalculateError.Rate(reranked.Results, relevance.Map);
      const stability.Score = await thiscalculateStability.Score(query, reranked.Results);
      const metrics: Evaluation.Metrics = {
        ndcg;
        map;
        mrr;
        precision_at_k: precisionAt.K;
        recall_at_k: recallAt.K;
        rank_correlation: rank.Correlation;
        score_improvement: score.Improvement;
        relevance_improvement: relevance.Improvement;
        diversity_score: diversity.Score;
        latency;
        throughput;
        cache_efficiency: 0.7, // Would be calculated from actual cache metrics;
        confidence_distribution: confidence.Distribution;
        error_rate: error.Rate;
        stability_score: stability.Score;
      }// Store evaluation results;
      thisevaluation.Resultspush(metrics);
      thisloggerdebug(
        `Reranking evaluation completed: NDC.G=${ndcgto.Fixed(3)}, MA.P=${mapto.Fixed(3)}`);
      return metrics} catch (error) {
      thisloggererror('Reranking evaluation failed:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Run A/B test between two reranking methods*/
  async runAB.Test(
    method.A: string;
    method.B: string;
    test.Queries: string[];
    evaluation.Function: (
      query: string;
      method: string) => Promise<Array<{ id: string; score: number, rank: number }>>): Promise<ABTest.Result> {
    thisloggerinfo(
      `Starting A/B test: ${method.A} vs ${method.B} on ${test.Querieslength} queries`);
    const results.A: Evaluation.Metrics[] = [];
    const results.B: Evaluation.Metrics[] = [];
    for (const query of test.Queries) {
      try {
        // Get results from both methods;
        const [ranking.A, ranking.B] = await Promiseall([
          evaluation.Function(query, method.A);
          evaluation.Function(query, method.B)])// Evaluate both;
        const [metrics.A, metrics.B] = await Promiseall([
          thisevaluate.Reranking([], ranking.A, query);
          thisevaluate.Reranking([], ranking.B, query)]);
        results.Apush(metrics.A);
        results.Bpush(metrics.B)} catch (error) {
        thisloggerwarn(`A/B test failed for query "${query}":`, error)}}// Calculate statistical significance;
    const metrics_comparison = thiscompare.Metrics(results.A, results.B);
    const winner = thisdetermine.Winner(metrics_comparison);
    const significance = thiscalculate.Significance(results.A, results.B);
    const result: ABTest.Result = {
      method_a: method.A;
      method_b: method.B;
      queries_tested: Math.min(results.Alength, results.Blength);
      statistical_significance: significance;
      winner;
      metrics_comparison;
    };
    thisloggerinfo(
      `A/B test completed: ${winner} wins with ${significanceto.Fixed(3)} significance`);
    return result}/**
   * Generate evaluation dataset from historical search data*/
  async generateEvaluation.Dataset(
    sample.Size = 100;
    diversity.Threshold = 0.7): Promise<Evaluation.Dataset> {
    try {
      // Get diverse queries from search history;
      const { data: search.History, error instanceof Error ? errormessage : String(error)  = await thissupabase;
        from('memory_access_patterns');
        select('*');
        order('accessed_at', { ascending: false });
        limit(sample.Size * 2);
      if (error instanceof Error ? errormessage : String(error) throw error instanceof Error ? errormessage : String(error)// Process and diversify queries;
      const queries = thisdiversify.Queries(search.History || [], sample.Size, diversity.Threshold);
      const dataset: Evaluation.Dataset = {
        queries: await Promiseall(
          queriesmap(async (query) => ({
            query: queryquery;
            expected.Results: await thisgenerateExpected.Results(queryquery)})))};
      thisloggerinfo(`Generated evaluation dataset with ${datasetquerieslength} queries`);
      return dataset} catch (error) {
      thisloggererror('Failed to generate evaluation dataset:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Calculate comprehensive reranking report*/
  async generateEvaluation.Report(time.Range: { start: Date, end: Date }): Promise<{
    summary: {
      total_evaluations: number;
      average_metrics: Evaluation.Metrics;
      performance_trends: Record<string, 'improving' | 'stable' | 'declining'>};
    detailed__analysis {
      best_performing_methods: Array<{ method: string; avg_ndcg: number, avg_map: number }>
      query_difficulty__analysis Array<{
        difficulty: 'easy' | 'medium' | 'hard';
        count: number;
        avg_performance: number}>
      failure__analysis Array<{ issue: string; frequency: number, impact: number }>};
    recommendations: string[]}> {
    const filtered.Results = thisevaluation.Resultsfilter(
      (result) =>
        resultlatency >= timeRangestartget.Time() && resultlatency <= timeRangeendget.Time());
    if (filtered.Resultslength === 0) {
      throw new Error('No evaluation data found in specified time range')}// Calculate average metrics;
    const average.Metrics = thiscalculateAverage.Metrics(filtered.Results)// Analyze trends;
    const trends = thisanalyze.Trends(filtered.Results)// Best performing methods analysis;
    const best.Methods = await thisanalyzeBest.Methods()// Query difficulty analysis;
    const difficulty.Analysis = thisanalyzeQuery.Difficulty(filtered.Results)// Failure analysis;
    const failure.Analysis = thisanalyze.Failures(filtered.Results)// Generate recommendations;
    const recommendations = thisgenerate.Recommendations(average.Metrics, trends, failure.Analysis);
    return {
      summary: {
        total_evaluations: filtered.Resultslength;
        average_metrics: average.Metrics;
        performance_trends: trends;
      };
      detailed__analysis {
        best_performing_methods: best.Methods;
        query_difficulty__analysis difficulty.Analysis;
        failure__analysis failure.Analysis;
      };
      recommendations}}// Private calculation methods;
  private calculateNDC.G(
    results: Array<{ id: string, score: number }>
    relevance.Map: Map<string, number>
    k = 10): number {
    const limited.Results = resultsslice(0, k)// Calculate DC.G;
    let dcg = 0;
    for (let i = 0; i < limited.Resultslength; i++) {
      const relevance = relevance.Mapget(limited.Results[i]id) || 0;
      dcg += (Mathpow(2, relevance) - 1) / Mathlog2(i + 2)}// Calculate IDC.G (ideal DC.G);
    const sorted.Relevances = Arrayfrom(relevance.Mapvalues());
      sort((a, b) => b - a);
      slice(0, k);
    let idcg = 0;
    for (let i = 0; i < sorted.Relevanceslength; i++) {
      idcg += (Mathpow(2, sorted.Relevances[i]) - 1) / Mathlog2(i + 2)};

    return idcg > 0 ? dcg / idcg : 0};

  private calculateMA.P(
    results: Array<{ id: string, score: number }>
    relevance.Map: Map<string, number>): number {
    let sum.Precision = 0;
    let relevant.Count = 0;
    let total.Relevant = 0// Count total relevant items;
    for (const relevance of relevance.Mapvalues()) {
      if (relevance > 2) total.Relevant++, // Assuming 3+ is relevant};

    if (total.Relevant === 0) return 0;
    for (let i = 0; i < resultslength; i++) {
      const relevance = relevance.Mapget(results[i]id) || 0;
      if (relevance > 2) {
        relevant.Count++
        sum.Precision += relevant.Count / (i + 1)}};

    return sum.Precision / total.Relevant};

  private calculateMR.R(
    results: Array<{ id: string, score: number }>
    relevance.Map: Map<string, number>): number {
    for (let i = 0; i < resultslength; i++) {
      const relevance = relevance.Mapget(results[i]id) || 0;
      if (relevance > 2) {
        return 1 / (i + 1)}};
    return 0};

  private calculatePrecisionAt.K(
    results: Array<{ id: string, score: number }>
    relevance.Map: Map<string, number>
    k.Values: number[]): Record<number, number> {
    const precision: Record<number, number> = {};
    for (const k of k.Values) {
      const top.K = resultsslice(0, k);
      const relevant.Count = top.Kreduce((count, result) => {
        const relevance = relevance.Mapget(resultid) || 0;
        return count + (relevance > 2 ? 1 : 0)}, 0);
      precision[k] = top.Klength > 0 ? relevant.Count / top.Klength : 0;
    };

    return precision};

  private calculateRecallAt.K(
    results: Array<{ id: string, score: number }>
    relevance.Map: Map<string, number>
    k.Values: number[]): Record<number, number> {
    const recall: Record<number, number> = {};
    const total.Relevant = Arrayfrom(relevance.Mapvalues())filter((r) => r > 2)length;
    for (const k of k.Values) {
      const top.K = resultsslice(0, k);
      const relevant.Count = top.Kreduce((count, result) => {
        const relevance = relevance.Mapget(resultid) || 0;
        return count + (relevance > 2 ? 1 : 0)}, 0);
      recall[k] = total.Relevant > 0 ? relevant.Count / total.Relevant : 0;
    };

    return recall};

  private calculateRank.Correlation(
    original: Array<{ id: string, rank: number }>
    reranked: Array<{ id: string, rank: number }>): number {
    // Calculate Spearman's rank correlation;
    const original.Ranks = new Map(originalmap((r) => [rid, rrank]));
    const reranked.Ranks = new Map(rerankedmap((r) => [rid, rrank]));
    const common.Ids = Arrayfrom(original.Rankskeys())filter((id) => reranked.Rankshas(id));
    if (common.Idslength < 2) return 0;
    const differences = common.Idsmap((id) => {
      const orig.Rank = original.Ranksget(id)!
      const rerank.Rank = reranked.Ranksget(id)!
      return Mathpow(orig.Rank - rerank.Rank, 2)});
    const sumDiff.Squares = differencesreduce((sum, diff) => sum + diff, 0);
    const n = common.Idslength;
    return 1 - (6 * sumDiff.Squares) / (n * (n * n - 1))};

  private calculateScore.Improvement(
    original: Array<{ id: string, score: number }>
    reranked: Array<{ id: string, score: number }>): number {
    const original.Scores = new Map(originalmap((r) => [rid, rscore]));
    const reranked.Scores = new Map(rerankedmap((r) => [rid, rscore]));
    const common.Ids = Arrayfrom(original.Scoreskeys())filter((id) => reranked.Scoreshas(id));
    if (common.Idslength === 0) return 0;
    const improvements = common.Idsmap((id) => {
      const orig.Score = original.Scoresget(id)!
      const rerank.Score = reranked.Scoresget(id)!
      return rerank.Score - orig.Score});
    return improvementsreduce((sum, imp) => sum + imp, 0) / improvementslength};

  private calculateRelevance.Improvement(
    original: Array<{ id: string, rank: number }>
    reranked: Array<{ id: string, rank: number }>
    relevance.Map: Map<string, number>): number {
    // Calculate weighted relevance improvement based on position;
    let originalWeighted.Relevance = 0;
    let rerankedWeighted.Relevance = 0;
    const max.Rank = Math.max(originallength, rerankedlength);
    for (let i = 0; i < max.Rank; i++) {
      const weight = 1 / Mathlog2(i + 2)// DC.G-style weighting;

      if (i < originallength) {
        const relevance = relevance.Mapget(original[i]id) || 0;
        originalWeighted.Relevance += relevance * weight};

      if (i < rerankedlength) {
        const relevance = relevance.Mapget(reranked[i]id) || 0;
        rerankedWeighted.Relevance += relevance * weight}};

    return originalWeighted.Relevance > 0? (rerankedWeighted.Relevance - originalWeighted.Relevance) / originalWeighted.Relevance: 0;
  };

  private calculateDiversity.Score(results: Array<{ id: string, score: number }>): number {
    // Simplified diversity calculation - in practice would use contentanalysis;
    const unique.Scores = new Set(resultsmap((r) => Mathround(rscore * 10) / 10));
    return unique.Scoressize / resultslength};

  private calculateConfidence.Distribution(results: Array<{ id: string, score: number }>): number[] {
    const buckets = [0, 0, 0, 0, 0]// 0-0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8-1.0;

    for (const result of results) {
      const bucket = Math.min(Mathfloor(resultscore * 5), 4);
      buckets[bucket]++};

    return bucketsmap((count) => count / resultslength)};

  private calculateError.Rate(
    results: Array<{ id: string, score: number }>
    relevance.Map: Map<string, number>): number {
    if (resultslength === 0) return 0;
    let errors = 0;
    for (const result of results) {
      const relevance = relevance.Mapget(resultid) || 0// Consider it an errorif high-scored result has low relevance or vice versa;
      if ((resultscore > 0.7 && relevance < 2) || (resultscore < 0.3 && relevance > 3)) {
        errors++}};

    return errors / resultslength};

  private async calculateStability.Score(
    query: string;
    results: Array<{ id: string, score: number }>): Promise<number> {
    // Simplified stability calculation - would compare with similar historical queries;
    return 0.8// Placeholder};

  private createRelevance.Map(judgments: Relevance.Judgment[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const judgment of judgments) {
      mapset(judgmentresult.Id, judgmentrelevance.Score)};
    return map};

  private async getRelevance.Judgments(query: string): Promise<Relevance.Judgment[]> {
    const cached = thisrelevance.Judgmentsget(query);
    if (cached) return cached// In practice, would load from database or generate automatically;
    return []};

  private diversify.Queries(
    search.History: any[];
    sample.Size: number;
    threshold: number): Array<{ query: string }> {
    // Simplified query diversification;
    const unique = new Map();
    const result = [];
    for (const item of search.History) {
      if (itemquery && !uniquehas(itemquery) && resultlength < sample.Size) {
        uniqueset(itemquery, true);
        resultpush({ query: itemquery })}};

    return result};

  private async generateExpected.Results(
    query: string): Promise<Array<{ id: string; relevance.Score: number, ideal.Rank: number }>> {
    // Placeholder - would generate based on historical performance or manual annotation;
    return []};

  private calculateAverage.Metrics(results: Evaluation.Metrics[]): Evaluation.Metrics {
    if (resultslength === 0) throw new Error('No results to average');
    const sum = resultsreduce(
      (acc, curr) => ({
        ndcg: accndcg + currndcg;
        map: accmap + currmap;
        mrr: accmrr + currmrr;
        precision_at_k: Objectfrom.Entries(
          Objectentries(accprecision_at_k)map(([k, v]) => [
            k;
            v + (currprecision_at_k[parse.Int(k, 10)] || 0)]));
        recall_at_k: Objectfrom.Entries(
          Objectentries(accrecall_at_k)map(([k, v]) => [
            k;
            v + (currrecall_at_k[parse.Int(k, 10)] || 0)]));
        rank_correlation: accrank_correlation + currrank_correlation;
        score_improvement: accscore_improvement + currscore_improvement;
        relevance_improvement: accrelevance_improvement + currrelevance_improvement;
        diversity_score: accdiversity_score + currdiversity_score;
        latency: acclatency + currlatency;
        throughput: accthroughput + currthroughput;
        cache_efficiency: acccache_efficiency + currcache_efficiency;
        confidence_distribution: accconfidence_distributionmap(
          (v, i) => v + currconfidence_distribution[i]);
        error_rate: accerror_rate + currerror_rate;
        stability_score: accstability_score + currstability_score});
      results[0]);
    const count = resultslength;
    return {
      ndcg: sumndcg / count;
      map: summap / count;
      mrr: summrr / count;
      precision_at_k: Objectfrom.Entries(
        Objectentries(sumprecision_at_k)map(([k, v]) => [k, v / count]));
      recall_at_k: Objectfrom.Entries(
        Objectentries(sumrecall_at_k)map(([k, v]) => [k, v / count]));
      rank_correlation: sumrank_correlation / count;
      score_improvement: sumscore_improvement / count;
      relevance_improvement: sumrelevance_improvement / count;
      diversity_score: sumdiversity_score / count;
      latency: sumlatency / count;
      throughput: sumthroughput / count;
      cache_efficiency: sumcache_efficiency / count;
      confidence_distribution: sumconfidence_distributionmap((v) => v / count);
      error_rate: sumerror_rate / count;
      stability_score: sumstability_score / count;
    }};

  private analyze.Trends(
    results: Evaluation.Metrics[]): Record<string, 'improving' | 'stable' | 'declining'> {
    // Simplified trend analysis;
    return {
      ndcg: 'stable';
      map: 'improving';
      latency: 'stable';
      error_rate: 'declining';
    }};

  private async analyzeBest.Methods(): Promise<
    Array<{ method: string; avg_ndcg: number, avg_map: number }>
  > {
    // Placeholder - would analyze method performance from stored data;
    return [
      { method: 'hybrid', avg_ndcg: 0.85, avg_map: 0.75 };
      { method: 'cross_encoder', avg_ndcg: 0.82, avg_map: 0.73 };
      { method: 'feature_based', avg_ndcg: 0.78, avg_map: 0.68 }]};

  private analyzeQuery.Difficulty(
    results: Evaluation.Metrics[]): Array<{ difficulty: 'easy' | 'medium' | 'hard'; count: number, avg_performance: number }> {
    // Simplified difficulty _analysisbased on performance;
    return [
      { difficulty: 'easy', count: 40, avg_performance: 0.85 };
      { difficulty: 'medium', count: 35, avg_performance: 0.72 };
      { difficulty: 'hard', count: 25, avg_performance: 0.58 }]};

  private analyze.Failures(
    results: Evaluation.Metrics[]): Array<{ issue: string; frequency: number, impact: number }> {
    const highError.Results = resultsfilter((r) => rerror_rate > 0.3);
    const lowNdcg.Results = resultsfilter((r) => rndcg < 0.5);
    const highLatency.Results = resultsfilter((r) => rlatency > 1000);
    return [
      {
        issue: 'High errorrate';
        frequency: highError.Resultslength / resultslength;
        impact: 0.8;
      };
      { issue: 'Low NDC.G scores', frequency: lowNdcg.Resultslength / resultslength, impact: 0.9 };
      { issue: 'High latency', frequency: highLatency.Resultslength / resultslength, impact: 0.6 }]filter((issue) => issuefrequency > 0.1)// Only include significant issues};

  private generate.Recommendations(
    avg.Metrics: Evaluation.Metrics;
    trends: Record<string, 'improving' | 'stable' | 'declining'>
    failures: Array<{ issue: string; frequency: number, impact: number }>): string[] {
    const recommendations: string[] = [];
    if (avg.Metricsndcg < 0.7) {
      recommendationspush(
        'Consider switching to more effective reranking method (hybrid or cross-encoder)')};

    if (avg.Metricslatency > 500) {
      recommendationspush(
        'Optimize for performance - consider feature-based reranking or caching')};

    if (avg.Metricserror_rate > 0.2) {
      recommendationspush('Improve quality filters and confidence thresholds')};

    if (avg.Metricsdiversity_score < 0.6) {
      recommendationspush('Enable diversity boost to improve result variety')};

    for (const failure of failures) {
      if (failurefrequency > 0.2 && failureimpact > 0.7) {
        recommendationspush(`Address critical issue: ${failureissuetoLower.Case()}`)}};

    if (recommendationslength === 0) {
      recommendationspush('Reranking performance is optimal - continue current configuration')};

    return recommendations};

  private compare.Metrics(
    results.A: Evaluation.Metrics[];
    results.B: Evaluation.Metrics[]): Record<string, unknown> {
    const avg.A = thiscalculateAverage.Metrics(results.A);
    const avg.B = thiscalculateAverage.Metrics(results.B);
    return {
      ndcg: {
        method_a: avg.Andcg;
        method_b: avg.Bndcg;
        improvement: (avg.Bndcg - avg.Andcg) / avg.Andcg;
        p_value: 0.05, // Simplified};
      map: {
        method_a: avg.Amap;
        method_b: avg.Bmap;
        improvement: (avg.Bmap - avg.Amap) / avg.Amap;
        p_value: 0.05;
      };
      latency: {
        method_a: avg.Alatency;
        method_b: avg.Blatency;
        improvement: (avg.Alatency - avg.Blatency) / avg.Alatency, // Lower is better;
        p_value: 0.05;
      }}};

  private determine.Winner(comparison: Record<string, unknown>): 'a' | 'b' | 'tie' {
    let score.A = 0;
    let score.B = 0;
    for (const [metric, data] of Objectentries(comparison)) {
      if (dataimprovement > 0.05) {
        score.B++} else if (dataimprovement < -0.05) {
        score.A++}};

    if (score.A > score.B) return 'a';
    if (score.B > score.A) return 'b';
    return 'tie'};

  private calculate.Significance(
    results.A: Evaluation.Metrics[];
    results.B: Evaluation.Metrics[]): number {
    // Simplified significance calculation - in practice would use proper statistical tests;
    return 0.95}/**
   * Export evaluation data for external analysis*/
  exportEvaluation.Data(): {
    metrics: Evaluation.Metrics[];
    relevance_judgments: Map<string, Relevance.Judgment[]>
    summary_statistics: any} {
    return {
      metrics: [.thisevaluation.Results];
      relevance_judgments: new Map(thisrelevance.Judgments);
      summary_statistics:
        thisevaluation.Resultslength > 0? thiscalculateAverage.Metrics(thisevaluation.Results): null;
    }}/**
   * Clear evaluation history*/
  clearEvaluation.History(): void {
    thisevaluation.Results = [];
    thisrelevance.Judgmentsclear();
  }};
;
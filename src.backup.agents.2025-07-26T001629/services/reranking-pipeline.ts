/**
 * Configurable Reranking Pipeline* Integrates multiple reranking strategies with the existing search infrastructure*/

import type { Supabase.Client } from '@supabase/supabase-js';
import type { Logger } from 'winston';
import {
  type Reranking.Metrics;
  type Reranking.Options;
  Reranking.Service;
  type Search.Result} from './reranking-service';
import {
  type MemorySearch.Result;
  type MultiStageSearch.Options;
  MultiStageSearch.System} from './memory/multi_stage_search';
export interface Pipeline.Config {
  // Reranking configuration;
  enable.Reranking: boolean;
  reranking.Method:
    | 'cross_encoder'| 'llm_judge'| 'hybrid'| 'feature_based'| 'learned'| 'adaptive';
  reranking.Threshold: number// Search configuration;
  search.Strategy: 'balanced' | 'precision' | 'recall' | 'speed';
  enableMulti.Stage: boolean;
  enable.Cache: boolean// Performance tuning;
  maxInitial.Results: number;
  maxFinal.Results: number;
  diversity.Boost: boolean;
  temporal.Weighting: number// Adaptive configuration;
  enable.Adaptive: boolean;
  adaptive.Thresholds: {
    performance.Threshold: number;
    fallback.Threshold: number;
    upgrade.Threshold: number;
  }// Quality assurance;
  enableQuality.Filters: boolean;
  minConfidence.Score: number;
  enable.Explainability: boolean;
};

export interface Pipeline.Result<T = Search.Result> {
  results: T[];
  pipeline: {
    search.Metrics: any;
    reranking.Metrics: Reranking.Metrics;
    total.Time: number;
    strategy: string;
    quality.Score: number;
  };
  explanation?: {
    search.Strategy: string;
    reranking.Method: string;
    quality.Filters: string[];
    adaptive.Adjustments: string[];
  }};

export interface Adaptive.Metrics {
  search.Performance: number;
  reranking.Effectiveness: number;
  user.Satisfaction: number;
  latency: number;
  cacheHit.Rate: number;
}/**
 * Configurable reranking pipeline with adaptive optimization*/
export class Reranking.Pipeline {
  private supabase: Supabase.Client;
  private logger: Logger;
  private reranking.Service: Reranking.Service;
  private multiStage.Search: MultiStageSearch.System// Performance tracking;
  private performance.History: Adaptive.Metrics[] = [];
  private config.History: {
    config: Pipeline.Config;
    timestamp: number;
    performance: Adaptive.Metrics}[] = []// Default configuration;
  private default.Config: Pipeline.Config = {
    enable.Reranking: true;
    reranking.Method: 'hybrid';
    reranking.Threshold: 0.6;
    search.Strategy: 'balanced';
    enableMulti.Stage: true;
    enable.Cache: true;
    maxInitial.Results: 50;
    maxFinal.Results: 20;
    diversity.Boost: true;
    temporal.Weighting: 0.3;
    enable.Adaptive: true;
    adaptive.Thresholds: {
      performance.Threshold: 0.7;
      fallback.Threshold: 0.4;
      upgrade.Threshold: 0.85;
    };
    enableQuality.Filters: true;
    minConfidence.Score: 0.5;
    enable.Explainability: false;
  };
  constructor(supabase: Supabase.Client, logger: Logger) {
    thissupabase = supabase;
    thislogger = logger;
    thisreranking.Service = new Reranking.Service(supabase, logger);
    thismultiStage.Search = new MultiStageSearch.System(supabase, logger)}/**
   * Main search pipeline with configurable reranking*/
  async search(
    query: string;
    embedding?: number[];
    user.Config: Partial<Pipeline.Config> = {
}): Promise<Pipeline.Result<MemorySearch.Result>> {
    const start.Time = Date.now();
    const config = thismerge.Config(user.Config);
    thisloggerdebug(
      `Starting pipeline search with strategy: ${configsearch.Strategy}, reranking: ${configreranking.Method}`);
    try {
      // Adaptive configuration adjustment;
      if (configenable.Adaptive) {
        configreranking.Method = thisgetAdaptiveReranking.Method(config);
        configsearch.Strategy = thisgetAdaptiveSearch.Strategy(config)}// Stage 1: Initial search;
      const search.Options: MultiStageSearch.Options = {
        query;
        embedding;
        max.Results: configmaxInitial.Results;
        search.Strategy: configsearch.Strategy;
        enableFallback.Search: true;
        similarity.Threshold: configreranking.Threshold;
      };
      const search.Result = embedding? await thismultiStage.Searchsearch(embedding, search.Options): await thisperformTextBased.Search(query, search.Options)// Stage 2: Reranking (if enabled);
      let reranking.Metrics: Reranking.Metrics = {
        original.Results: search.Resultresultslength;
        final.Results: search.Resultresultslength;
        reranking.Time: 0;
        method: 'none';
        cache.Hit: false;
        averageScore.Improvement: 0;
        diversity.Score: 0;
      };
      let final.Results = search.Resultresults;
      if (configenable.Reranking && search.Resultresultslength > 0) {
        const reranking.Options: Reranking.Options = {
          method: configreranking.Method;
          query;
          max.Results: configmaxFinal.Results;
          use.Cache: configenable.Cache;
          explain.Ranking: configenable.Explainability;
          diversity.Boost: configdiversity.Boost;
        };
        const reranking.Result = await thisreranking.Servicererank(
          query;
          thisconvertToSearch.Results(search.Resultresults);
          reranking.Options);
        reranking.Metrics = reranking.Resultmetrics;
        final.Results = thisconvertFromSearch.Results(reranking.Resultresults)}// Stage 3: Quality filtering (if enabled);
      if (configenableQuality.Filters) {
        final.Results = thisapplyQuality.Filters(final.Results, config)}// Limit final results;
      final.Results = final.Resultsslice(0, configmaxFinal.Results)// Calculate quality score;
      const quality.Score = thiscalculateQuality.Score(final.Results, reranking.Metrics, config)// Record performance metrics;
      const total.Time = Date.now() - start.Time;
      const pipeline.Metrics = {
        search.Performance: searchResultmetricstotalSearch.Time < 500 ? 0.8 : 0.6;
        reranking.Effectiveness: rerankingMetricsaverageScore.Improvement;
        user.Satisfaction: quality.Score;
        latency: total.Time;
        cacheHit.Rate: searchResultmetricscache.Hits > 0 ? 1.0 : 0.0};
      thisrecord.Performance(pipeline.Metrics, config);
      const result: Pipeline.Result<MemorySearch.Result> = {
        results: final.Results;
        pipeline: {
          search.Metrics: search.Resultmetrics;
          reranking.Metrics;
          total.Time;
          strategy: `${configsearch.Strategy}_${configreranking.Method}`;
          quality.Score}}// Add explanation if requested;
      if (configenable.Explainability) {
        resultexplanation = thisgenerate.Explanation(config, search.Result, reranking.Metrics)};

      thisloggerinfo(
        `Pipeline search completed in ${total.Time}ms: ${final.Resultslength} results, quality: ${qualityScoreto.Fixed(3)}`);
      return result} catch (error) {
      thisloggererror('Pipeline search failed:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Search knowledge entities with reranking*/
  async searchKnowledge.Entities(
    query: string;
    embedding: number[];
    user.Config: Partial<Pipeline.Config> = {
}): Promise<Pipeline.Result> {
    const config = thismerge.Config(user.Config);
    const start.Time = Date.now();
    try {
      // Use database function with reranking;
      const { data, error } = await thissupabaserpc('search_knowledge_entities', {
        query_embedding: embedding;
        similarity_threshold: configreranking.Threshold;
        limit_count: configmaxFinal.Results;
        query_text: query;
        enable_reranking: configenable.Reranking;
        rerank_method: configreranking.Method});
      if (error instanceof Error ? errormessage : String(error) throw error instanceof Error ? errormessage : String(error);

      const results = datamap((item: any) => ({
        id: itemid;
        content`${itemname}: ${itemdescription || ''}`;
        similarity: itemsimilarity;
        rerank.Score: itemrerank_score;
        rerank.Method: itemrerank_method;
        entity.Type: itementity_type;
        name: itemname;
        description: itemdescription;
        properties: itemproperties}));
      const quality.Score = thiscalculateQuality.Score(
        results;
        {
          original.Results: resultslength;
          final.Results: resultslength;
          reranking.Time: Date.now() - start.Time;
          method: configreranking.Method;
          cache.Hit: false;
          averageScore.Improvement:
            resultsreduce((sum: number, r: any) => sum + (rrerank.Score - rsimilarity), 0) /
            resultslength;
          diversity.Score: thiscalculateEntity.Diversity(results);
        };
        config);
      return {
        results;
        pipeline: {
          search.Metrics: { totalSearch.Time: Date.now() - start.Time };
          reranking.Metrics: {
            original.Results: resultslength;
            final.Results: resultslength;
            reranking.Time: Date.now() - start.Time;
            method: configreranking.Method;
            cache.Hit: false;
            averageScore.Improvement: 0;
            diversity.Score: thiscalculateEntity.Diversity(results);
          };
          total.Time: Date.now() - start.Time;
          strategy: `knowledge_${configreranking.Method}`;
          quality.Score}}} catch (error) {
      thisloggererror('Knowledge entity search failed:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Get optimized configuration based on current performance*/
  getOptimized.Config(base.Config: Partial<Pipeline.Config> = {}): Pipeline.Config {
    const config = thismerge.Config(base.Config);
    if (!configenable.Adaptive || thisperformance.Historylength < 5) {
      return config};

    const recent.Performance = thisperformance.Historyslice(-10);
    const avg.Performance = thiscalculateAverage.Performance(recent.Performance)// Adaptive adjustments based on performance;
    if (avgPerformancesearch.Performance < configadaptiveThresholdsperformance.Threshold) {
      configsearch.Strategy = 'speed';
      configmaxInitial.Results = Math.max(configmaxInitial.Results * 0.8, 20)};

    if (avgPerformancereranking.Effectiveness < 0.1) {
      configreranking.Method = 'feature_based'// Fallback to simpler method};

    if (avg.Performancelatency > 1000) {
      configenable.Reranking = false// Disable reranking if too slow;
      configenableMulti.Stage = false};

    if (avgPerformancecacheHit.Rate < 0.3) {
      configenable.Cache = true, // Force cache if hit rate is low};
;
    return config}/**
   * Analyze pipeline performance and provide recommendations*/
  analyze.Performance(): {
    current.Performance: Adaptive.Metrics;
    trends: Record<string, 'improving' | 'stable' | 'declining'>
    recommendations: string[];
    config.Suggestions: Partial<Pipeline.Config>} {
    if (thisperformance.Historylength < 5) {
      return {
        current.Performance: thisgetDefault.Metrics();
        trends: {
};
        recommendations: ['Not enough data for _analysis];
        config.Suggestions: {
}}};

    const recent = thisperformance.Historyslice(-10);
    const older = thisperformance.Historyslice(-20, -10);
    const current = thiscalculateAverage.Performance(recent);
    const previous = thiscalculateAverage.Performance(older);
    const trends = {
      search.Performance: thisget.Trend(currentsearch.Performance, previoussearch.Performance);
      reranking.Effectiveness: thisget.Trend(
        currentreranking.Effectiveness;
        previousreranking.Effectiveness);
      user.Satisfaction: thisget.Trend(currentuser.Satisfaction, previoususer.Satisfaction);
      latency: thisget.Trend(previouslatency, currentlatency), // Reverse for latency;
      cacheHit.Rate: thisget.Trend(currentcacheHit.Rate, previouscacheHit.Rate)};
    const recommendations: string[] = [];
    const config.Suggestions: Partial<Pipeline.Config> = {}// Generate recommendations;
    if (trendssearch.Performance === 'declining') {
      recommendationspush('Search performance is declining - consider optimizing search strategy');
      configSuggestionssearch.Strategy = 'speed'};

    if (trendsreranking.Effectiveness === 'declining') {
      recommendationspush('Reranking effectiveness is low - try different reranking method');
      configSuggestionsreranking.Method = 'hybrid'};

    if (trendslatency === 'declining') {
      recommendationspush(
        'Response time is increasing - reduce result limits or disable features');
      configSuggestionsmaxInitial.Results = 30;
      configSuggestionsenable.Reranking = false};

    if (trendscacheHit.Rate === 'declining') {
      recommendationspush('Cache hit rate is low - review cache configuration');
      configSuggestionsenable.Cache = true};

    if (recommendationslength === 0) {
      recommendationspush('Pipeline performance is optimal')};
;
    return {
      current.Performance: current;
      trends;
      recommendations;
      config.Suggestions;
    }}// Private helper methods;
  private merge.Config(user.Config: Partial<Pipeline.Config>): Pipeline.Config {
    return { .thisdefault.Config, .user.Config }};

  private async performTextBased.Search(query: string, options: MultiStageSearch.Options) {
    // For text-based search without embedding, use database text search;
    const { data, error } = await thissupabaserpc('search_memories_withcontext', {
      query_text: query;
      agent_id: optionsagent.Filter || null;
      importance_threshold: optionssimilarity.Threshold || 0.3;
      limit_count: optionsmax.Results || 20;
      temporal_weight: 0.3;
      enable_reranking: false, // We'll handle reranking separately;
      rerank_method: 'none'});
    if (error instanceof Error ? errormessage : String(error) throw error instanceof Error ? errormessage : String(error);

    const results = datamap((item: any) => ({
      id: itemid;
      contentitemcontent;
      service.Id: itemagent_id;
      memory.Type: 'text_search';
      similarity: itemfinal_score;
      importance.Score: itemimportance;
      access.Count: 0;
      metadata: {
}}));
    return {
      results;
      metrics: {
        totalSearch.Time: 100;
        clusterSearch.Time: 0;
        detailSearch.Time: 100;
        clusters.Evaluated: 0;
        memories.Evaluated: resultslength;
        cache.Hits: 0;
        search.Strategy: 'text_search';
        fallback.Used: false;
      }}};

  private convertToSearch.Results(memory.Results: MemorySearch.Result[]): Search.Result[] {
    return memory.Resultsmap((result) => ({
      id: resultid;
      contentresultcontent;
      similarity: resultsimilarity;
      metadata: resultmetadata;
      importance.Score: resultimportance.Score;
      access.Count: resultaccess.Count;
      recency: thiscalculate.Recency(new Date())}))};

  private convertFromSearch.Results(search.Results: Search.Result[]): MemorySearch.Result[] {
    return search.Resultsmap((result) => ({
      id: resultid;
      contentresultcontent;
      service.Id: resultmetadata?service.Id || 'unknown';
      memory.Type: resultmetadata?memory.Type || 'unknown';
      similarity: resultsimilarity;
      importance.Score: resultimportance.Score || 0.5;
      access.Count: resultaccess.Count || 0;
      metadata: resultmetadata || {
}}))};

  private applyQuality.Filters(
    results: MemorySearch.Result[];
    config: Pipeline.Config): MemorySearch.Result[] {
    return resultsfilter((result) => {
      // Confidence score filter;
      const confidence = (result as any)confidence || resultsimilarity;
      if (confidence < configminConfidence.Score) {
        return false}// Content quality filters;
      if (resultcontent-length < 10) {
        return false// Too short};

      if (resultcontent-length > 5000) {
        return false// Too long};

      return true})};

  private calculateQuality.Score(
    results: any[];
    reranking.Metrics: Reranking.Metrics;
    config: Pipeline.Config): number {
    if (resultslength === 0) return 0;
    let quality.Score = 0// Result count quality (not too few, not too many);
    const count.Score = Math.min(resultslength / configmaxFinal.Results, 1.0);
    quality.Score += count.Score * 0.2// Average similarity quality;
    const avg.Similarity = resultsreduce((sum, r) => sum + rsimilarity, 0) / resultslength;
    quality.Score += avg.Similarity * 0.3// Reranking improvement;
    quality.Score += Math.max(rerankingMetricsaverageScore.Improvement, 0) * 0.2// Diversity quality;
    quality.Score += rerankingMetricsdiversity.Score * 0.2// Performance quality (latency consideration);
    const performance.Score = rerankingMetricsreranking.Time < 500 ? 1.0 : 0.5;
    quality.Score += performance.Score * 0.1;
    return Math.min(quality.Score, 1.0)};

  private calculateEntity.Diversity(results: any[]): number {
    if (resultslength === 0) return 0;
    const entity.Types = new Set(resultsmap((r) => rentity.Type || 'unknown'));
    return entity.Typessize / resultslength};

  private getAdaptiveReranking.Method(config: Pipeline.Config): Pipeline.Config['reranking.Method'] {
    if (thisperformance.Historylength < 3) return configreranking.Method;
    const recent.Performance = thiscalculateAverage.Performance(thisperformance.Historyslice(-5));
    if (recent.Performancelatency > 800) {
      return 'feature_based'// Faster method};

    if (recentPerformancereranking.Effectiveness < 0.1) {
      return 'cross_encoder'// More effective method};

    return 'hybrid'// Balanced approach};

  private getAdaptiveSearch.Strategy(config: Pipeline.Config): Pipeline.Config['search.Strategy'] {
    if (thisperformance.Historylength < 3) return configsearch.Strategy;
    const recent.Performance = thiscalculateAverage.Performance(thisperformance.Historyslice(-5));
    if (recent.Performancelatency > 1000) {
      return 'speed'};

    if (recentPerformanceuser.Satisfaction < 0.6) {
      return 'recall'};

    return 'balanced'};

  private record.Performance(metrics: Adaptive.Metrics, config: Pipeline.Config): void {
    thisperformance.Historypush(metrics);
    thisconfig.Historypush({
      config: { .config };
      timestamp: Date.now();
      performance: metrics})// Keep only recent history (last 100 entries);
    if (thisperformance.Historylength > 100) {
      thisperformance.History = thisperformance.Historyslice(-100)};

    if (thisconfig.Historylength > 100) {
      thisconfig.History = thisconfig.Historyslice(-100)}};

  private calculateAverage.Performance(metrics: Adaptive.Metrics[]): Adaptive.Metrics {
    if (metricslength === 0) return thisgetDefault.Metrics();
    return {
      search.Performance: metricsreduce((sum, m) => sum + msearch.Performance, 0) / metricslength;
      reranking.Effectiveness:
        metricsreduce((sum, m) => sum + mreranking.Effectiveness, 0) / metricslength;
      user.Satisfaction: metricsreduce((sum, m) => sum + muser.Satisfaction, 0) / metricslength;
      latency: metricsreduce((sum, m) => sum + mlatency, 0) / metricslength;
      cacheHit.Rate: metricsreduce((sum, m) => sum + mcacheHit.Rate, 0) / metricslength}};

  private get.Trend(current: number, previous: number): 'improving' | 'stable' | 'declining' {
    const change = (current - previous) / previous;
    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'declining';
    return 'stable'};

  private getDefault.Metrics(): Adaptive.Metrics {
    return {
      search.Performance: 0.7;
      reranking.Effectiveness: 0.5;
      user.Satisfaction: 0.6;
      latency: 300;
      cacheHit.Rate: 0.5;
    }};

  private calculate.Recency(date: Date): number {
    const days.Since = (Date.now() - dateget.Time()) / (1000 * 60 * 60 * 24);
    return Mathexp(-days.Since / 30)// 30-day decay};

  private generate.Explanation(
    config: Pipeline.Config;
    search.Result: any;
    reranking.Metrics: Reranking.Metrics): Pipeline.Result['explanation'] {
    const quality.Filters: string[] = [];
    const adaptive.Adjustments: string[] = [];
    if (configenableQuality.Filters) {
      quality.Filterspush(`Minimum confidence: ${configminConfidence.Score}`);
      quality.Filterspush('Content length validation')};

    if (configenable.Adaptive) {
      adaptive.Adjustmentspush('Method selection based on performance history');
      adaptive.Adjustmentspush('Dynamic threshold adjustment')};

    return {
      search.Strategy: `${configsearch.Strategy} (${search.Resultmetrics?search.Strategy || 'standard'})`;
      reranking.Method: `${configreranking.Method} (improvement: ${rerankingMetricsaverageScoreImprovementto.Fixed(3)})`;
      quality.Filters;
      adaptive.Adjustments}}/**
   * Get current pipeline statistics*/
  get.Statistics(): {
    total.Searches: number;
    average.Latency: number;
    current.Config: Pipeline.Config;
    performance.Trends: Record<string, 'improving' | 'stable' | 'declining'>} {
    const _analysis= thisanalyze.Performance();
    return {
      total.Searches: thisperformance.Historylength;
      average.Latency: _analysiscurrent.Performancelatency;
      current.Config: thisdefault.Config;
      performance.Trends: _analysistrends;
    }}/**
   * Reset pipeline performance history*/
  resetPerformance.History(): void {
    thisperformance.History = [];
    thisconfig.History = [];
  }};
;
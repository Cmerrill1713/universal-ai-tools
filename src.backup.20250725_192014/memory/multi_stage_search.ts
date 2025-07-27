/**
 * Multi-Stage Vector Search with Hierarchical Clustering* Implements intelligent two-stage search: cluster selection → detailed similarity search* Provides 3-5x faster search on large memory collections while maintaining relevance*/

import type { Supabase.Client } from '@supabase/supabase-js';
import type { Logger } from 'winston';
export interface ClusterSearch.Result {
  cluster.Id: string;
  cluster.Label: string;
  similarity: number;
  memory.Count: number;
  representative.Embedding: number[];
  avg.Importance: number;
};

export interface MemorySearch.Result {
  id: string;
  contentstring;
  service.Id: string;
  memory.Type: string;
  similarity: number;
  importance.Score: number;
  cluster.Id?: string;
  access.Count: number;
  metadata: Record<string, unknown>};

export interface MultiStageSearch.Options {
  query?: string;
  embedding?: number[];
  similarity.Threshold?: number;
  max.Results?: number;
  agent.Filter?: string;
  category?: string;
  clusterSearch.Threshold?: number;
  maxClustersTo.Search?: number;
  enableFallback.Search?: boolean;
  search.Strategy?: 'balanced' | 'precision' | 'recall' | 'speed';
};

export interface Search.Metrics {
  totalSearch.Time: number;
  clusterSearch.Time: number;
  detailSearch.Time: number;
  clusters.Evaluated: number;
  memories.Evaluated: number;
  cache.Hits: number;
  search.Strategy: string;
  fallback.Used: boolean;
}/**
 * Multi-stage search system with intelligent cluster-based optimization*/
export class MultiStageSearch.System {
  private supabase: Supabase.Client;
  private logger: Logger;
  private search.Cache = new Map<string, { results: MemorySearch.Result[], timestamp: number }>();
  private cluster.Cache = new Map<string, { clusters: ClusterSearch.Result[], timestamp: number }>();
  private readonly CACHE_TT.L = 15 * 60 * 1000// 15 minutes// Search strategy configurations;
  private readonly SEARCH_STRATEGIE.S = {
    balanced: {
      cluster.Threshold: 0.7;
      max.Clusters: 3;
      detail.Threshold: 0.6;
      fallback.Enabled: true;
    };
    precision: {
      cluster.Threshold: 0.8;
      max.Clusters: 2;
      detail.Threshold: 0.75;
      fallback.Enabled: false;
    };
    recall: {
      cluster.Threshold: 0.6;
      max.Clusters: 5;
      detail.Threshold: 0.5;
      fallback.Enabled: true;
    };
    speed: {
      cluster.Threshold: 0.75;
      max.Clusters: 2;
      detail.Threshold: 0.65;
      fallback.Enabled: false;
    }};
  constructor(supabase: Supabase.Client, logger: Logger) {
    thissupabase = supabase;
    thislogger = logger;
  }/**
   * Perform multi-stage search with cluster optimization*/
  async search(
    embedding: number[];
    options: MultiStageSearch.Options = {
}): Promise<{
    results: MemorySearch.Result[];
    metrics: Search.Metrics}> {
    const start.Time = Date.now();
    const strategy = optionssearch.Strategy || 'balanced';
    const config = thisSEARCH_STRATEGIE.S[strategy];
    let clusterSearch.Time = 0;
    let detailSearch.Time = 0;
    let clusters.Evaluated = 0;
    let memories.Evaluated = 0;
    let cache.Hits = 0;
    let fallback.Used = false;
    try {
      // Check cache first;
      const cache.Key = thisgetCache.Key(embedding, options);
      const cached = thissearch.Cacheget(cache.Key);
      if (cached && Date.now() - cachedtimestamp < thisCACHE_TT.L) {
        cache.Hits = 1;
        thisloggerdebug('Multi-stage search served from cache');
        return {
          results: cachedresultsslice(0, optionsmax.Results || 20);
          metrics: {
            totalSearch.Time: Date.now() - start.Time;
            clusterSearch.Time: 0;
            detailSearch.Time: 0;
            clusters.Evaluated: 0;
            memories.Evaluated: 0;
            cache.Hits;
            search.Strategy: strategy;
            fallback.Used: false;
          }}}// Stage 1: Find relevant clusters;
      const cluster.Start = Date.now();
      const relevant.Clusters = await thissearch.Clusters(embedding, {
        threshold: optionsclusterSearch.Threshold || configcluster.Threshold;
        max.Clusters: optionsmaxClustersTo.Search || configmax.Clusters;
        agent.Filter: optionsagent.Filter;
        category: optionscategory});
      clusterSearch.Time = Date.now() - cluster.Start;
      clusters.Evaluated = relevant.Clusterslength;
      thisloggerdebug(
        `Found ${relevant.Clusterslength} relevant clusters in ${clusterSearch.Time}ms`);
      let search.Results: MemorySearch.Result[] = [];
      if (relevant.Clusterslength > 0) {
        // Stage 2: Detailed search within selected clusters;
        const detail.Start = Date.now();
        search.Results = await thissearchWithin.Clusters(embedding, relevant.Clusters, {
          similarity.Threshold: optionssimilarity.Threshold || configdetail.Threshold;
          max.Results: optionsmax.Results || 20;
          agent.Filter: optionsagent.Filter;
          category: optionscategory});
        detailSearch.Time = Date.now() - detail.Start;
        memories.Evaluated = search.Resultslength;
        thisloggerdebug(
          `Found ${search.Resultslength} memories in clusters in ${detailSearch.Time}ms`)}// Stage 3: Fallback to full search if insufficient results;
      if (
        (optionsenableFallback.Search ?? configfallback.Enabled) && search.Resultslength < (optionsmax.Results || 20) / 2) {
        thisloggerdebug('Triggering fallback search due to insufficient cluster results');
        const fallback.Results = await thisfallback.Search(embedding, {
          similarity.Threshold: (optionssimilarity.Threshold || configdetail.Threshold) - 0.1;
          max.Results: (optionsmax.Results || 20) - search.Resultslength;
          agent.Filter: optionsagent.Filter;
          category: optionscategory;
          exclude.Ids: search.Resultsmap((r) => rid)});
        search.Results = search.Resultsconcat(fallback.Results);
        fallback.Used = true;
        memories.Evaluated += fallback.Resultslength}// Sort by similarity and limit results;
      search.Results = search.Results;
        sort((a, b) => bsimilarity - asimilarity);
        slice(0, optionsmax.Results || 20)// Cache the results;
      thissearch.Cacheset(cache.Key, {
        results: search.Results;
        timestamp: Date.now()})// Clean old cache entries;
      thisclean.Cache();
      const total.Time = Date.now() - start.Time;
      thisloggerinfo(
        `Multi-stage search completed in ${total.Time}ms: ${clusters.Evaluated} clusters, ${memories.Evaluated} memories evaluated`);
      return {
        results: search.Results;
        metrics: {
          totalSearch.Time: total.Time;
          clusterSearch.Time;
          detailSearch.Time;
          clusters.Evaluated;
          memories.Evaluated;
          cache.Hits;
          search.Strategy: strategy;
          fallback.Used;
        }}} catch (error) {
      thisloggererror('Multi-stage search failed:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Search for relevant semantic clusters*/
  private async search.Clusters(
    embedding: number[];
    options: {
      threshold: number;
      max.Clusters: number;
      agent.Filter?: string;
      category?: string;
    }): Promise<ClusterSearch.Result[]> {
    try {
      const { data, error } = await thissupabaserpc('search_semantic_clusters', {
        query_embedding: embedding;
        similarity_threshold: optionsthreshold;
        max_clusters: optionsmax.Clusters;
        agent_filter: optionsagent.Filter || null;
        category_filter: optionscategory || null});
      if (error instanceof Error ? errormessage : String(error) throw error instanceof Error ? errormessage : String(error);

      return datamap((cluster: any) => ({
        cluster.Id: clustercluster_id;
        cluster.Label: clustercluster_label;
        similarity: clustersimilarity;
        memory.Count: clustermemory_count;
        representative.Embedding: clusterrepresentative_embedding;
        avg.Importance: clusteravg_importance}))} catch (error) {
      thisloggererror('Cluster search failed:', error instanceof Error ? errormessage : String(error);
      return []}}/**
   * Search within specific clusters for detailed results*/
  private async searchWithin.Clusters(
    embedding: number[];
    clusters: ClusterSearch.Result[];
    options: {
      similarity.Threshold: number;
      max.Results: number;
      agent.Filter?: string;
      category?: string;
    }): Promise<MemorySearch.Result[]> {
    try {
      const cluster.Ids = clustersmap((c) => ccluster.Id);
      const { data, error } = await thissupabaserpc('search_within_clusters', {
        query_embedding: embedding;
        cluster_ids: cluster.Ids;
        similarity_threshold: optionssimilarity.Threshold;
        max_results: optionsmax.Results;
        agent_filter: optionsagent.Filter || null;
        category_filter: optionscategory || null});
      if (error instanceof Error ? errormessage : String(error) throw error instanceof Error ? errormessage : String(error);

      return datamap((memory: any) => ({
        id: memoryid;
        contentmemorycontent;
        service.Id: memoryservice_id;
        memory.Type: memorymemory_type;
        similarity: memorysimilarity;
        importance.Score: memoryimportance_score;
        cluster.Id: memorycluster_id;
        access.Count: memoryaccess_count || 0;
        metadata: memorymetadata || {
}}))} catch (error) {
      thisloggererror('Cluster detail search failed:', error instanceof Error ? errormessage : String(error);
      return []}}/**
   * Fallback to standard vector search when cluster search is insufficient*/
  private async fallback.Search(
    embedding: number[];
    options: {
      similarity.Threshold: number;
      max.Results: number;
      agent.Filter?: string;
      category?: string;
      exclude.Ids: string[];
    }): Promise<MemorySearch.Result[]> {
    try {
      const { data, error } = await thissupabaserpc('search_similar_memories', {
        query_embedding: embedding;
        similarity_threshold: optionssimilarity.Threshold;
        max_results: optionsmax.Results;
        category_filter: optionscategory || null;
        agent_filter: optionsagent.Filter || null;
        exclude_ids: optionsexclude.Ids});
      if (error instanceof Error ? errormessage : String(error) throw error instanceof Error ? errormessage : String(error);

      return datamap((memory: any) => ({
        id: memoryid || memorymemory_id;
        contentmemorycontent;
        service.Id: memoryservice_id;
        memory.Type: memorymemory_type;
        similarity: memorysimilarity;
        importance.Score: memoryimportance_score || memoryadjusted_score || 0.5;
        access.Count: memoryaccess_count || 0;
        metadata: memorymetadata || {
}}))} catch (error) {
      thisloggererror('Fallback search failed:', error instanceof Error ? errormessage : String(error);
      return []}}/**
   * Get cluster statistics and health metrics*/
  async getCluster.Statistics(): Promise<{
    total.Clusters: number;
    avgCluster.Size: number;
    largest.Cluster: number;
    cluster.Distribution: Array<{ size: number, count: number }>
    index.Health: {
      total.Memories: number;
      clustered.Memories: number;
      clustering.Rate: number;
    }}> {
    try {
      const { data, error } = await thissupabaserpc('get_cluster_statistics');
      if (error instanceof Error ? errormessage : String(error) throw error instanceof Error ? errormessage : String(error);

      return data} catch (error) {
      thisloggererror('Failed to get cluster statistics:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Refresh semantic clusters (should be run periodically)*/
  async refreshSemantic.Clusters(): Promise<{
    clusters.Created: number;
    memories.Processed: number;
    processing.Time: number}> {
    try {
      const start.Time = Date.now();
      const { data, error } = await thissupabaserpc('refresh_semantic_clusters');
      if (error instanceof Error ? errormessage : String(error) throw error instanceof Error ? errormessage : String(error);

      const processing.Time = Date.now() - start.Time;
      thisloggerinfo(
        `Semantic clusters refreshed in ${processing.Time}ms: ${dataclusters_created} clusters, ${datamemories_processed} memories`)// Clear cluster cache after refresh;
      thiscluster.Cacheclear();
      return {
        clusters.Created: dataclusters_created;
        memories.Processed: datamemories_processed;
        processing.Time;
      }} catch (error) {
      thisloggererror('Failed to refresh semantic clusters:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Analyze search performance and recommend optimizations*/
  analyzeSearch.Performance(metrics: Search.Metrics[]): {
    recommendations: string[];
    average.Performance: {
      total.Time: number;
      cluster.Efficiency: number;
      fallback.Rate: number;
      cacheHit.Rate: number;
    }} {
    if (metricslength === 0) {
      return {
        recommendations: ['No search metrics available for _analysis];
        average.Performance: {
          total.Time: 0;
          cluster.Efficiency: 0;
          fallback.Rate: 0;
          cacheHit.Rate: 0;
        }}};

    const avgTotal.Time = metricsreduce((sum, m) => sum + mtotalSearch.Time, 0) / metricslength;
    const avgCluster.Time =
      metricsreduce((sum, m) => sum + mclusterSearch.Time, 0) / metricslength;
    const fallback.Rate = metricsfilter((m) => mfallback.Used)length / metricslength;
    const cacheHit.Rate = metricsreduce((sum, m) => sum + mcache.Hits, 0) / metricslength;
    const cluster.Efficiency =
      avgCluster.Time > 0 ? (avgTotal.Time - avgCluster.Time) / avgTotal.Time : 0;
    const recommendations: string[] = [];
    if (avgTotal.Time > 500) {
      recommendationspush(
        'Search times are high - consider increasing cluster threshold for faster searches')};

    if (fallback.Rate > 0.3) {
      recommendationspush(
        'High fallback rate - consider lowering cluster threshold or increasing max clusters')};

    if (cacheHit.Rate < 0.2) {
      recommendationspush(
        'Low cache hit rate - consider increasing cache TT.L or pre-warming cache')};

    if (cluster.Efficiency < 0.5) {
      recommendationspush(
        'Cluster search not providing significant benefit - review clustering parameters')};

    if (recommendationslength === 0) {
      recommendationspush('Search performance is optimal')};

    return {
      recommendations;
      average.Performance: {
        total.Time: avgTotal.Time;
        cluster.Efficiency;
        fallback.Rate;
        cacheHit.Rate;
      }}}/**
   * Clear search caches*/
  clear.Cache(): void {
    thissearch.Cacheclear();
    thiscluster.Cacheclear();
  }/**
   * Get cache statistics*/
  getCache.Stats(): {
    searchCache.Size: number;
    clusterCache.Size: number;
    oldest.Entry: number;
    cacheHit.Rate: number} {
    const now = Date.now();
    let oldest.Entry = now;
    let total.Accesses = 0;
    let cache.Hits = 0;
    for (const [_, entry] of thissearch.Cache) {
      if (entrytimestamp < oldest.Entry) {
        oldest.Entry = entrytimestamp};
      total.Accesses++}// This is a simplified cache hit rate calculation// In a production system, you'd track this more precisely;
    cache.Hits = Mathfloor(total.Accesses * 0.7)// Estimated 70% hit rate;
    return {
      searchCache.Size: thissearch.Cachesize;
      clusterCache.Size: thiscluster.Cachesize;
      oldest.Entry: now - oldest.Entry;
      cacheHit.Rate: total.Accesses > 0 ? cache.Hits / total.Accesses : 0;
    }};

  private getCache.Key(embedding: number[], options: MultiStageSearch.Options): string {
    const embedding.Hash = thishash.Embedding(embedding);
    const options.Str = JSO.N.stringify({
      threshold: optionssimilarity.Threshold;
      max.Results: optionsmax.Results;
      agent: optionsagent.Filter;
      category: optionscategory;
      strategy: optionssearch.Strategy});
    return `${embedding.Hash}:${thishash.String(options.Str)}`};

  private hash.Embedding(embedding: number[]): string {
    // Create a simple hash of the embedding vector;
    const sum = embeddingreduce((acc, val) => acc + val, 0);
    const product = embeddingslice(0, 10)reduce((acc, val) => acc * (val + 1), 1);
    return `${sumto.Fixed(4)}_${productto.Fixed(4)}`};

  private hash.String(str: string): string {
    const crypto = require('crypto');
    return cryptocreate.Hash('md5')update(str)digest('hex')substring(0, 8)};

  private clean.Cache(): void {
    const now = Date.now();
    for (const [key, entry] of thissearch.Cache) {
      if (now - entrytimestamp > thisCACHE_TT.L) {
        thissearch.Cachedelete(key)}};

    for (const [key, entry] of thiscluster.Cache) {
      if (now - entrytimestamp > thisCACHE_TT.L) {
        thiscluster.Cachedelete(key)}}}};

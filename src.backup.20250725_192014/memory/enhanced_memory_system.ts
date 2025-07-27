/**
 * Enhanced Memory System with Vector Search* Integrates Supabase pgvector for semantic memory capabilities*/

import type { Supabase.Client } from '@supabase/supabase-js';
import type { Logger } from 'winston';
import type { Embedding.Config } from './production_embedding_service';
import { ProductionEmbedding.Service } from './production_embedding_service';
import type { OllamaEmbedding.Config } from './ollama_embedding_service';
import { OllamaEmbedding.Service, getOllamaEmbedding.Service } from './ollama_embedding_service';
import type { MemoryCache.System } from './memory_cache_system';
import { getCache.System } from './memory_cache_system';
import type { ContextualMemory.Enricher } from './contextual_memory_enricher';
import { getMemory.Enricher } from './contextual_memory_enricher';
import type { MultiStageSearch.Options, Search.Metrics } from './multi_stage_search';
import { MultiStageSearch.System } from './multi_stage_search';
import type {
  AccessPattern.Learner;
  Learning.Insights;
  Utility.Score} from './access_pattern_learner';
import { getAccessPattern.Learner } from './access_pattern_learner';
export interface MemorySearch.Options {
  query?: string;
  embedding?: number[];
  similarity.Threshold?: number;
  max.Results?: number;
  category?: string;
  agent.Filter?: string;
  time.Range?: {
    start: Date;
    end: Date;
  }// Multi-stage search options;
  enableMulti.Stage?: boolean;
  search.Strategy?: 'balanced' | 'precision' | 'recall' | 'speed';
  clusterSearch.Threshold?: number;
  maxClustersTo.Search?: number;
  enableFallback.Search?: boolean// Access _patternlearning options;
  enableUtility.Ranking?: boolean;
  record.Access?: boolean;
  session.Context?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
};

export interface Memory {
  id: string;
  service.Id: string;
  memory.Type: string;
  contentstring;
  metadata: Record<string, unknown>
  embedding?: number[];
  importance.Score: number;
  access.Count: number;
  last.Accessed?: Date;
  keywords?: string[];
  related.Entities?: any[];
};

export interface Memory.Connection {
  sourceMemory.Id: string;
  targetMemory.Id: string;
  connection.Type: string;
  strength: number;
  metadata?: Record<string, unknown>};

export class EnhancedMemory.System {
  private supabase: Supabase.Client;
  private logger: Logger;
  private embedding.Service: ProductionEmbedding.Service | OllamaEmbedding.Service;
  private cache.System: MemoryCache.System;
  private contextual.Enricher: ContextualMemory.Enricher;
  private multiStage.Search: MultiStageSearch.System;
  private access.Learner: AccessPattern.Learner;
  private embedding.Model = 'nomic-embed-text';
  private embedding.Dimension = 768;
  private use.Ollama = true;
  constructor(
    supabase: Supabase.Client;
    logger: Logger;
    embedding.Config?: Embedding.Config | OllamaEmbedding.Config;
    cache.Config?: any;
    options?: { use.Ollama?: boolean }) {
    thissupabase = supabase;
    thislogger = logger;
    thisuse.Ollama = options?use.Ollama ?? true;
    if (thisuse.Ollama) {
      // Use Ollama by default;
      const ollama.Config = embedding.Config as OllamaEmbedding.Config;
      const model = ollama.Config?model || 'nomic-embed-text'// Set dimensions based on model;
      const dimensions = ollama.Config?dimensions || (model === 'nomic-embed-text' ? 768 : 768);
      thisembedding.Service = getOllamaEmbedding.Service({
        dimensions;
        maxBatch.Size: 16;
        cacheMax.Size: 10000.ollama.Config;
        model});
      thisembedding.Model = model;
      thisembedding.Dimension = dimensions} else {
      // Fallback to OpenA.I;
      const openai.Config = embedding.Config as Embedding.Config;
      const model = openai.Config?model || 'text-embedding-3-large'// Set dimensions based on model;
      const dimensions =
        openai.Config?dimensions ||
        (model === 'text-embedding-3-large'? 1536: model === 'text-embedding-3-small'? 1536: 1536), // Default to 1536 for OpenA.I;

      thisembedding.Service = new ProductionEmbedding.Service({
        dimensions;
        maxBatch.Size: 32;
        cacheMax.Size: 10000.openai.Config;
        model});
      thisembedding.Model = model;
      thisembedding.Dimension = dimensions};

    thiscache.System = getCache.System(cache.Config);
    thiscontextual.Enricher = getMemory.Enricher();
    thismultiStage.Search = new MultiStageSearch.System(supabase, logger);
    thisaccess.Learner = getAccessPattern.Learner(supabase, logger)}/**
   * Store a memory with contextual enrichment and embedding generation*/
  async store.Memory(
    service.Id: string;
    memory.Type: string;
    content: string;
    metadata: Record<string, unknown> = {};
    keywords?: string[]): Promise<Memory> {
    try {
      // Perform contextual enrichment;
      const enrichment.Result = thiscontextualEnricherenrich.Memory(
        content;
        service.Id;
        memory.Type;
        metadata);
      thisloggerdebug(
        `Contextual enrichment extracted ${enrichment.Resultenrichmententitieslength} entities and ${enrichment.Resultenrichmentconceptslength} concepts`)// Generate embedding for the contextually enriched content;
      const embedding = await thisgenerate.Embedding(enrichmentResultcontextual.Content)// Determine importance score based on enrichment data;
      const enrichedImportance.Score = thiscalculateEnriched.Importance(
        enrichment.Resultenrichment;
        metadataimportance || 0.5)// Store memory with embedding and enriched metadata;
      const { data, error } = await thissupabase;
        from('ai_memories');
        insert({
          service_id: service.Id;
          memory_type: memory.Type;
          content;
          metadata: enrichmentResultenhanced.Metadata;
          embedding;
          embedding_model: thisembedding.Model;
          keywords: keywords || thisextractKeywordsFrom.Enrichment(enrichment.Resultenrichment);
          related_entities: enrichment.Resultenrichmententities;
          importance_score: enrichedImportance.Score;
          memory_category: thiscategorizeMemoryFrom.Enrichment(
            enrichment.Resultenrichment;
            memory.Type)});
        select();
        single();
      if (error) throw error;
      thisloggerinfo(
        `Stored enriched memory with ${enrichment.Resultenrichmententitieslength} entities for ${service.Id}`)// Format memory for caching;
      const formatted.Memory = thisformat.Memory(data)// Cache the memory in appropriate tier (importance-based);
      thiscacheSystemstore.Memory(formatted.Memory)// Cache both original and contextual embeddings;
      thiscacheSystemcache.Embedding(contentembedding);
      thiscacheSystemcache.Embedding(enrichmentResultcontextual.Content, embedding)// Invalidate search cache since new memory was added;
      thiscacheSysteminvalidateSearch.Cache()// Automatically create connections to similar memories;
      await thiscreateSimilarity.Connections(dataid, embedding);
      return formatted.Memory} catch (error) {
      thisloggererror('Failed to store enriched memory:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Search memories using vector similarity with caching*/
  async search.Memories(options: MemorySearch.Options): Promise<Memory[]> {
    try {
      // Use multi-stage search if enabled;
      if (optionsenableMulti.Stage) {
        const result = await thismultiStageSearch.Memories(options);
        return resultresults};

      let embedding: number[]// Generate embedding from query if not provided;
      if (optionsquery && !optionsembedding) {
        // Check cache for embedding first;
        const cached.Embedding = thiscacheSystemgetCached.Embedding(optionsquery);
        if (cached.Embedding) {
          embedding = cached.Embedding} else {
          embedding = await thisgenerate.Embedding(optionsquery);
          thiscacheSystemcache.Embedding(optionsquery, embedding)}} else if (optionsembedding) {
        embedding = optionsembedding} else {
        throw new Error('Either query or embedding must be provided')}// Create cache key for search results;
      const searchCache.Key = {
        query.Hash: thishash.Query(optionsquery || JSO.N.stringify(embedding));
        similarity.Threshold: optionssimilarity.Threshold || 0.7;
        max.Results: optionsmax.Results || 20;
        agent.Filter: optionsagent.Filter;
        category: optionscategory}// Check search result cache;
      const cached.Results = thiscacheSystemgetCachedSearch.Results(searchCache.Key);
      if (cached.Results) {
        thisloggerdebug('Search results served from cache')// Still track access for the top result;
        if (cached.Resultslength > 0) {
          await thistrackMemory.Access(
            cached.Results[0]id;
            optionsagent.Filter || 'unknown';
            embedding;
            0.8 // Approximate similarity for cached results)};

        return cached.Results}// Call the vector search function;
      const { data, error } = await thissupabaserpc('search_similar_memories', {
        query_embedding: embedding;
        similarity_threshold: optionssimilarity.Threshold || 0.7;
        max_results: optionsmax.Results || 20;
        category_filter: optionscategory || null;
        agent_filter: optionsagent.Filter || null});
      if (error) throw error;
      const formatted.Results = datamap((memory: any) => thisformat.Memory(memory))// Cache the search results;
      thiscacheSystemcacheSearch.Results(searchCache.Key, formatted.Results)// Cache individual memories that were returned;
      formattedResultsfor.Each((memory: Memory) => {
        thiscacheSystemstore.Memory(memory)})// Apply utility-based re-ranking if enabled;
      if (optionsenableUtility.Ranking && formatted.Resultslength > 0) {
        const reRanked.Results = await thisaccessLearnerreRank.Results(
          formatted.Resultsmap((memory: Memory) => ({
            .memory;
            similarity.Score: datafind((d: any) => dmemory_id === memoryid)?similarity || 0}));
          optionsagent.Filter || 'unknown';
          {
            query.Embedding: embedding;
            session.Context: optionssession.Context;
            urgency: optionsurgency;
          })// Sort by new ranking and return;
        const final.Results = reRanked.Results;
          sort((a, b) => anew.Rank - bnew.Rank);
          map((result) => {
            const { original.Rank, new.Rank, utility.Score, final.Score, .memory } = result as any;
            return memory as Memory})// Track access patterns for top result;
        if (optionsrecord.Access !== false) {
          await thisrecordMemory.Access(
            final.Results[0]id;
            optionsagent.Filter || 'unknown';
            'search';
            {
              query.Embedding: embedding;
              similarity.Score: reRanked.Results[0]utilityScorefinal.Score;
              session.Context: optionssession.Context;
              urgency: optionsurgency;
            })};

        return final.Results}// Track access patterns for standard search;
      if (formatted.Resultslength > 0 && optionsrecord.Access !== false) {
        await thisrecordMemory.Access(
          formatted.Results[0]id;
          optionsagent.Filter || 'unknown';
          'search';
          {
            query.Embedding: embedding;
            similarity.Score: data[0]similarity;
            session.Context: optionssession.Context;
            urgency: optionsurgency;
          })};

      return formatted.Results} catch (error) {
      thisloggererror('Failed to search memories:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Advanced multi-stage search with hierarchical clustering*/
  async multiStageSearch.Memories(options: MemorySearch.Options): Promise<{
    results: Memory[];
    metrics: Search.Metrics}> {
    try {
      let embedding: number[]// Generate embedding from query if not provided;
      if (optionsquery && !optionsembedding) {
        const cached.Embedding = thiscacheSystemgetCached.Embedding(optionsquery);
        if (cached.Embedding) {
          embedding = cached.Embedding} else {
          embedding = await thisgenerate.Embedding(optionsquery);
          thiscacheSystemcache.Embedding(optionsquery, embedding)}} else if (optionsembedding) {
        embedding = optionsembedding} else {
        throw new Error('Either query or embedding must be provided')}// Convert options to multi-stage format;
      const multiStage.Options: MultiStageSearch.Options = {
        embedding;
        similarity.Threshold: optionssimilarity.Threshold;
        max.Results: optionsmax.Results;
        agent.Filter: optionsagent.Filter;
        category: optionscategory;
        clusterSearch.Threshold: optionsclusterSearch.Threshold;
        maxClustersTo.Search: optionsmaxClustersTo.Search;
        enableFallback.Search: optionsenableFallback.Search;
        search.Strategy: optionssearch.Strategy;
      }// Perform multi-stage search;
      const { results: search.Results, metrics } = await thismultiStage.Searchsearch(
        embedding;
        multiStage.Options)// Convert to Memory format;
      const formatted.Results: Memory[] = search.Resultsmap((result) => ({
        id: resultid;
        service.Id: resultservice.Id;
        memory.Type: resultmemory.Type;
        content: resultcontent;
        metadata: resultmetadata;
        importance.Score: resultimportance.Score;
        access.Count: resultaccess.Count;
        keywords: [];
        related.Entities: []}))// Cache the results;
      const searchCache.Key = {
        query.Hash: thishash.Query(optionsquery || JSO.N.stringify(embedding));
        similarity.Threshold: optionssimilarity.Threshold || 0.7;
        max.Results: optionsmax.Results || 20;
        agent.Filter: optionsagent.Filter;
        category: optionscategory};
      thiscacheSystemcacheSearch.Results(searchCache.Key, formatted.Results)// Track access patterns for top result;
      if (formatted.Resultslength > 0) {
        await thistrackMemory.Access(
          formatted.Results[0]id;
          optionsagent.Filter || 'unknown';
          embedding;
          search.Results[0]similarity)};

      thisloggerinfo(
        `Multi-stage search completed: ${metricsclusters.Evaluated} clusters, ${metricsmemories.Evaluated} memories in ${metricstotalSearch.Time}ms`);
      return {
        results: formatted.Results;
        metrics;
      }} catch (error) {
      thisloggererror('Failed to perform multi-stage search:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Find memories across multiple agents*/
  async crossAgent.Search(
    query: string;
    agent.List: string[];
    options: Partial<MemorySearch.Options> = {
}): Promise<Record<string, Memory[]>> {
    try {
      const embedding = await thisgenerate.Embedding(query);
      const { data, error } = await thissupabaserpc('cross_agent_memory_search', {
        query_embedding: embedding;
        agent_list: agent.List;
        similarity_threshold: optionssimilarity.Threshold || 0.6;
        max_per_agent: optionsmax.Results || 5});
      if (error) throw error// Group results by agent;
      const grouped.Results: Record<string, Memory[]> = {};
      datafor.Each((result: any) => {
        if (!grouped.Results[resultservice_id]) {
          grouped.Results[resultservice_id] = [];
        };
        grouped.Results[resultservice_id]push(thisformat.Memory(result))});
      return grouped.Results} catch (error) {
      thisloggererror('Failed to perform cross-agent search:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Find connected memories (graph traversal)*/
  async findConnected.Memories(
    memory.Id: string;
    connection.Types?: string[];
    max.Depth = 3): Promise<Memory[]> {
    try {
      const { data, error } = await thissupabaserpc('find_connected_memories', {
        start_memory_id: memory.Id;
        connection_types: connection.Types || null;
        max_depth: max.Depth;
        min_strength: 0.3});
      if (error) throw error;
      return datamap((memory: any) => thisformat.Memory(memory))} catch (error) {
      thisloggererror('Failed to find connected memories:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Get memory recommendations for a user*/
  async getMemory.Recommendations(
    user.Id: string;
    agent.Name: string;
    current.Context?: string): Promise<Memory[]> {
    try {
      let context.Embedding = null;
      if (current.Context) {
        context.Embedding = await thisgenerate.Embedding(current.Context)};

      const { data, error } = await thissupabaserpc('recommend_related_memories', {
        user_id: user.Id;
        agent_name: agent.Name;
        currentcontext: context.Embedding;
        limit_results: 10});
      if (error) throw error;
      return datamap((memory: any) => thisformat.Memory(memory))} catch (error) {
      thisloggererror('Failed to get memory recommendations:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Update memory importance based on access*/
  async updateMemory.Importance(memory.Id: string, boost = 0.1): Promise<void> {
    try {
      // Get current values first;
      const { data: current.Memory } = await thissupabase;
        from('ai_memories');
        select('importance_score, access_count');
        eq('id', memory.Id);
        single();
      if (current.Memory) {
        const new.Importance = Math.min(current.Memoryimportance_score + boost, 1.0);
        const newAccess.Count = current.Memoryaccess_count + 1;
        const { error instanceof Error ? errormessage : String(error)  = await thissupabase;
          from('ai_memories');
          update({
            importance_score: new.Importance;
            access_count: newAccess.Count;
            last_accessed: new Date()toISO.String()});
          eq('id', memory.Id);
        if (error) throw error}} catch (error) {
      thisloggererror('Failed to update memory importance:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Create a connection between memories*/
  async createMemory.Connection(
    source.Id: string;
    target.Id: string;
    connection.Type: string;
    strength = 0.5;
    metadata: Record<string, unknown> = {}): Promise<void> {
    try {
      const { error instanceof Error ? errormessage : String(error)  = await thissupabasefrom('memory_connections')upsert({
        source_memory_id: source.Id;
        target_memory_id: target.Id;
        connection_type: connection.Type;
        strength;
        metadata});
      if (error) throw error;
      thisloggerinfo(`Created ${connection.Type} connection between memories`)} catch (error) {
      thisloggererror('Failed to create memory connection:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Generate embedding using configured service (Ollama or OpenA.I)*/
  private async generate.Embedding(text: string): Promise<number[]> {
    try {
      return await thisembeddingServicegenerate.Embedding(text)} catch (error) {
      thisloggererror;
        `Failed to generate embedding using ${thisuse.Ollama ? 'Ollama' : 'OpenA.I'}:`;
        error)// If using Ollama and it fails, check if it's available;
      if (thisuse.Ollama && thisembedding.Service instanceof OllamaEmbedding.Service) {
        const health = await thisembeddingServicecheck.Health();
        if (!healthavailable) {
          thisloggerwarn(
            'Ollama is not available. Make sure Ollama is running at http://localhost:11434')} else if (!healthmodel.Loaded) {
          thisloggerwarn(
            `Model ${thisembedding.Model} is not loaded. Try running: ollama pull ${thisembedding.Model}`)}}// Fallback to mock embedding if service fails;
      thisloggerwarn('Falling back to mock embedding');
      return new Array(thisembedding.Dimension)fill(0)map(() => Mathrandom())}}/**
   * Generate multiple embeddings efficiently*/
  private async generate.Embeddings(texts: string[]): Promise<number[][]> {
    try {
      return await thisembeddingServicegenerate.Embeddings(texts)} catch (error) {
      thisloggererror('Failed to generate batch embeddings:', error instanceof Error ? errormessage : String(error)// Fallback to individual generation;
      const embeddings: number[][] = [];
      for (const text of texts) {
        embeddingspush(await thisgenerate.Embedding(text))};
      return embeddings}}/**
   * Get embedding service statistics*/
  getEmbedding.Stats() {
    return thisembeddingServiceget.Stats()}/**
   * Pre-warm embedding cache with common terms*/
  async preWarmEmbedding.Cache(common.Texts: string[]): Promise<void> {
    await thisembeddingServicepreWarm.Cache(common.Texts);
  }/**
   * Get cache statistics for monitoring*/
  getCache.Stats() {
    return {
      embedding: thisembeddingServiceget.Stats();
      memory: thiscacheSystemgetCache.Stats();
    }}/**
   * Optimize cache performance*/
  optimize.Caches(): {
    memory: { promoted: number, demoted: number };
    overview: any} {
    const memory.Optimization = thiscacheSystemoptimizeCache.Tiers();
    const hot.Entries = thiscacheSystemgetHot.Entries();
    return {
      memory: memory.Optimization;
      overview: {
        hot.Memories: hotEntrieshot.Memorieslength;
        hot.Searches: hotEntrieshot.Searcheslength;
        hot.Embeddings: hotEntrieshot.Embeddingslength;
      }}}/**
   * Clear all caches*/
  clear.Caches(): void {
    thisembeddingServiceclear.Cache();
    thiscacheSystemclearAll.Caches();
  }/**
   * Pre-warm memory cache with frequently accessed memories*/
  async preWarmMemory.Cache(limit = 100): Promise<void> {
    try {
      const { data: frequent.Memories, error instanceof Error ? errormessage : String(error)  = await thissupabase;
        from('ai_memories');
        select('*');
        order('access_count', { ascending: false });
        order('importance_score', { ascending: false });
        limit(limit);
      if (error) throw error;
      if (frequent.Memories) {
        const formatted.Memories = frequent.Memoriesmap(thisformat.Memory);
        thiscacheSystempreWarm.Cache(formatted.Memories);
        thisloggerinfo(
          `Pre-warmed cache with ${formatted.Memorieslength} frequently accessed memories`)}} catch (error) {
      thisloggererror('Failed to pre-warm memory cache:', error instanceof Error ? errormessage : String(error)  }}/**
   * Hash query for cache key generation*/
  private hash.Query(query: string): string {
    const crypto = require('crypto');
    return cryptocreate.Hash('md5')update(querytrim()toLower.Case())digest('hex')}/**
   * Calculate enriched importance score based on contextual analysis*/
  private calculateEnriched.Importance(enrichment: any, base.Importance: number): number {
    let adjusted.Importance = base.Importance// Boost importance based on urgency;
    if (enrichmentintenturgency === 'critical') {
      adjusted.Importance += 0.3} else if (enrichmentintenturgency === 'high') {
      adjusted.Importance += 0.2} else if (enrichmentintenturgency === 'low') {
      adjusted.Importance -= 0.1}// Boost importance for action items;
    if (enrichmentintentcategory === 'action' || enrichmentintentcategory === 'request {
      adjusted.Importance += 0.15}// Boost importance for entities (people, organizations, etc.);
    const importantEntity.Types = ['person', 'organization', 'email', 'phone'];
    const hasImportant.Entities = enrichmententitiessome((e: any) =>
      importantEntity.Typesincludes(etype));
    if (hasImportant.Entities) {
      adjusted.Importance += 0.1}// Boost importance for technical content;
    if (
      enrichmentcomplexitytechnical.Level === 'expert' || enrichmentcomplexitytechnical.Level === 'advanced') {
      adjusted.Importance += 0.1}// Boost importance for concepts with high relevance;
    const highRelevance.Concepts = enrichmentconceptsfilter((c: any) => crelevance > 0.8);
    adjusted.Importance += highRelevance.Conceptslength * 0.05;
    return Math.min(1.0, Math.max(0.0, adjusted.Importance))}/**
   * Extract keywords from enrichment data*/
  private extractKeywordsFrom.Enrichment(enrichment: any): string[] {
    const keywords: string[] = []// Add intent and category as keywords;
    keywordspush(enrichmentintentintent, enrichmentintentcategory)// Add entity values as keywords;
    enrichmententitiesfor.Each((entity: any) => {
      if (entitytype !== 'other' && entityvaluelength <= 50) {
        keywordspush(entityvaluetoLower.Case());
      }})// Add top concepts as keywords;
    enrichmentconcepts;
      filter((concept: any) => conceptrelevance > 0.5);
      slice(0, 10);
      for.Each((concept: any) => {
        keywordspush(.conceptkeywords)})// Add temporal keywords if present;
    if (enrichmenttemporalhasTime.Reference) {
      keywordspush(enrichmenttemporaltemporal.Type);
      if (enrichmenttemporalurgency) {
        keywordspush(enrichmenttemporalurgency)}}// Remove duplicates and filter out very short keywords;
    return [.new Set(keywords)]filter((keyword) => keyword && keywordlength >= 3)slice(0, 20)// Limit to top 20 keywords}/**
   * Categorize memory based on enrichment data*/
  private categorizeMemoryFrom.Enrichment(enrichment: any, memory.Type: string): string {
    // Check intent-based categorization first;
    if (enrichmentintentcategory === 'action' || enrichmentintentcategory === 'request {
      return 'task'};

    if (enrichmentintentcategory === 'question') {
      return 'inquiry'}// Check concept-based categorization;
    const action.Concepts = enrichmentconceptsfilter((c: any) => ccategory === 'action');
    const technical.Concepts = enrichmentconceptsfilter((c: any) => ccategory === 'technical');
    const temporal.Concepts = enrichmentconceptsfilter((c: any) => ccategory === 'temporal');
    if (action.Conceptslength > 0) {
      return 'task'};

    if (technical.Conceptslength > 0) {
      return 'technical'};

    if (temporal.Conceptslength > 0 || enrichmenttemporalhasTime.Reference) {
      return 'scheduled'}// Check entity-based categorization;
    const hasPerson.Entities = enrichmententitiessome((e: any) => etype === 'person');
    const hasOrg.Entities = enrichmententitiessome((e: any) => etype === 'organization');
    if (hasPerson.Entities || hasOrg.Entities) {
      return 'social'}// Fallback to memory type or general;
    if (memory.Type === 'consolidated') return 'consolidated';
    return 'general'}/**
   * Contextual search that enriches queries before searching*/
  async contextual.Search(
    query: string;
    options: MemorySearch.Options = {
}): Promise<{
    results: Memory[];
    query.Enrichment: any;
    search.Strategy: string}> {
    try {
      // Enrich the query for better context understanding;
      const query.Enrichment = thiscontextualEnricherenrich.Memory(
        query;
        optionsagent.Filter || 'system';
        'search_query');
      thisloggerdebug(
        `Query enrichment found ${query.Enrichmentenrichmententitieslength} entities and ${query.Enrichmentenrichmentconceptslength} concepts`)// Use contextual contentfor embedding generation;
      const enriched.Options = {
        .options;
        query: queryEnrichmentcontextual.Content}// Perform the search with enriched query;
      const results = await thissearch.Memories(enriched.Options)// Determine search strategy based on enrichment;
      let search.Strategy = 'standard';
      if (query.Enrichmentenrichmentintenturgency === 'critical') {
        search.Strategy = 'priority'} else if (query.Enrichmentenrichmententitieslength > 2) {
        search.Strategy = 'entity-focused'} else if (queryEnrichmentenrichmenttemporalhasTime.Reference) {
        search.Strategy = 'temporal-aware'};

      return {
        results;
        query.Enrichment: query.Enrichmentenrichment;
        search.Strategy;
      }} catch (error) {
      thisloggererror('Failed to perform contextual search:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Extract keywords from content*/
  private extract.Keywords(contentstring): string[] {
    // Simple keyword extraction - in production, use NL.P;
    const words = content;
      toLower.Case();
      split(/\W+/);
      filter((word) => wordlength > 4);
    const word.Freq: Record<string, number> = {};
    wordsfor.Each((word) => {
      word.Freq[word] = (word.Freq[word] || 0) + 1});
    return Objectentries(word.Freq);
      sort((a, b) => b[1] - a[1]);
      slice(0, 10);
      map(([word]) => word)}/**
   * Extract entities from content*/
  private extract.Entities(contentstring): any[] {
    // Simple entity extraction - in production, use NE.R;
    const entities: any[] = []// Extract emails;
    const emails = contentmatch(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2}\b/g);
    if (emails) {
      entitiespush(.emailsmap((email) => ({ type: 'email', value: email })))}// Extract UR.Ls;
    const urls = contentmatch(
      /https?:\/\/(www\.)?[-a-z.A-Z0-9@:%._\+~#=]{1,256}\.[a-z.A-Z0-9()]{1,6}\b([-a-z.A-Z0-9()@:%_\+.~#?&//=]*)/g);
    if (urls) {
      entitiespush(.urlsmap((url) => ({ type: 'url', value: url })))};

    return entities}/**
   * Categorize memory based on type and content*/
  private categorize.Memory(memory.Type: string, contentstring): string {
    // Simple categorization logic;
    if (memory.Type === 'consolidated') return 'consolidated';
    if (contenttoLower.Case()includes('task') || contenttoLower.Case()includes('todo'));
      return 'task';
    if (contenttoLower.Case()includes('meeting') || contenttoLower.Case()includes('appointment'));
      return 'calendar';
    if (contenttoLower.Case()includes('code') || contenttoLower.Case()includes('function'));
      return 'technical';
    return 'general'}/**
   * Create automatic connections to similar memories*/
  private async createSimilarity.Connections(memory.Id: string, embedding: number[]): Promise<void> {
    try {
      // Find top 3 similar memories;
      const { data } = await thissupabaserpc('search_similar_memories', {
        query_embedding: embedding;
        similarity_threshold: 0.8;
        max_results: 4, // Include self, so we get 3 others});
      if (data) {
        for (const similar of data) {
          if (similarmemory_id !== memory.Id) {
            await thiscreateMemory.Connection(
              memory.Id;
              similarmemory_id;
              'semantic_similarity';
              similarsimilarity)}}}} catch (error) {
      thisloggerwarn('Failed to create similarity connections:', error instanceof Error ? errormessage : String(error)  }}/**
   * Record memory access _patternusing the access learner*/
  async recordMemory.Access(
    memory.Id: string;
    agent.Name: string;
    access.Type: 'search' | 'direct' | 'related' | 'contextual';
    options: {
      query.Embedding?: number[];
      similarity.Score?: number;
      response.Useful?: boolean;
      interaction.Duration?: number;
      session.Context?: string;
      urgency?: 'low' | 'medium' | 'high' | 'critical'} = {}): Promise<void> {
    try {
      await thisaccessLearnerrecord.Access(memory.Id, agent.Name, access.Type, {
        query.Embedding: optionsquery.Embedding;
        similarity.Score: optionssimilarity.Score;
        response.Useful: optionsresponse.Useful;
        interaction.Duration: optionsinteraction.Duration;
        contextual.Factors: {
          timeOf.Day: new Date()get.Hours();
          session.Length: 0, // Could be tracked from session start;
          task.Type: optionssession.Context;
          urgency: optionsurgency;
        }})} catch (error) {
      thisloggerwarn('Failed to record memory access:', error instanceof Error ? errormessage : String(error)  }}/**
   * Record user feedback for a memory interaction*/
  async recordUser.Feedback(
    memory.Id: string;
    agent.Name: string;
    feedback: {
      relevance: number// 1-5 scale;
      helpfulness: number// 1-5 scale;
      accuracy: number// 1-5 scale};
    followUp.Queries?: string[]): Promise<void> {
    try {
      await thisaccessLearnerrecordUser.Feedback(memory.Id, agent.Name, feedback, followUp.Queries);
      thisloggerinfo(
        `Recorded user feedback for memory ${memory.Id}: relevance=${feedbackrelevance}`)} catch (error) {
      thisloggererror('Failed to record user feedback:', error instanceof Error ? errormessage : String(error)  }}/**
   * Track memory access patterns (legacy method for compatibility)*/
  private async trackMemory.Access(
    memory.Id: string;
    agent.Name: string;
    query.Embedding: number[];
    similarity.Score: number): Promise<void> {
    await thisrecordMemory.Access(memory.Id, agent.Name, 'search', {
      query.Embedding;
      similarity.Score;
      response.Useful: true})}/**
   * Format raw database memory to Memory interface*/
  private format.Memory(data: any): Memory {
    return {
      id: dataid || datamemory_id;
      service.Id: dataservice_id;
      memory.Type: datamemory_type;
      content: datacontent;
      metadata: datametadata || {
};
      embedding: dataembedding;
      importance.Score: dataimportance_score || dataadjusted_score || 0.5;
      access.Count: dataaccess_count || 0;
      last.Accessed: datalast_accessed ? new Date(datalast_accessed) : undefined;
      keywords: datakeywords || [];
      related.Entities: datarelated_entities || [];
    }}/**
   * Get memory statistics*/
  async getMemory.Stats(agent.Name?: string): Promise<unknown> {
    try {
      const query = thissupabase;
        from('ai_memories');
        select('service_id, memory_type, importance_score, access_count', { count: 'exact' });
      if (agent.Name) {
        queryeq('service_id', agent.Name)};

      const { data, count, error instanceof Error ? errormessage : String(error)  = await query;
      if (error) throw error;
      return {
        total.Memories: count;
        by.Type: thisgroup.By(data, 'memory_type');
        by.Agent: thisgroup.By(data, 'service_id');
        avg.Importance: datareduce((sum, m) => sum + mimportance_score, 0) / datalength;
        total.Accesses: datareduce((sum, m) => sum + maccess_count, 0)}} catch (error) {
      thisloggererror('Failed to get memory stats:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}};

  private group.By(array: any[], key: string): Record<string, number> {
    return arrayreduce((result, item) => {
      result[item[key]] = (result[item[key]] || 0) + 1;
      return result}, {})}/**
   * Get cluster statistics and health metrics*/
  async getCluster.Statistics(): Promise<unknown> {
    try {
      return await thismultiStageSearchgetCluster.Statistics()} catch (error) {
      thisloggererror('Failed to get cluster statistics:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Refresh semantic clusters for improved search performance*/
  async refreshSemantic.Clusters(): Promise<{
    clusters.Created: number;
    memories.Processed: number;
    processing.Time: number}> {
    try {
      const result = await thismultiStageSearchrefreshSemantic.Clusters()// Clear relevant caches after cluster refresh;
      thiscacheSysteminvalidateSearch.Cache();
      thismultiStageSearchclear.Cache();
      thisloggerinfo(
        `Semantic clusters refreshed: ${resultclusters.Created} clusters created, ${resultmemories.Processed} memories processed`);
      return result} catch (error) {
      thisloggererror('Failed to refresh semantic clusters:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Analyze search performance and get optimization recommendations*/
  analyzeSearch.Performance(search.Metrics: Search.Metrics[]): {
    recommendations: string[];
    average.Performance: any} {
    return thismultiStageSearchanalyzeSearch.Performance(search.Metrics)}/**
   * Get comprehensive system statistics including clustering*/
  async getSystem.Statistics(): Promise<{
    memory: any;
    cluster: any;
    cache: any;
    embedding: any}> {
    try {
      const [memory.Stats, cluster.Stats, cache.Stats, embedding.Stats] = await Promiseall([
        thisgetMemory.Stats();
        thisgetCluster.Statistics();
        Promiseresolve(thisgetCache.Stats());
        Promiseresolve(thisgetEmbedding.Stats())]);
      return {
        memory: memory.Stats;
        cluster: cluster.Stats;
        cache: cache.Stats;
        embedding: embedding.Stats;
      }} catch (error) {
      thisloggererror('Failed to get system statistics:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Clear all caches including multi-stage search cache*/
  clearAll.Caches(): void {
    thisclear.Caches();
    thismultiStageSearchclear.Cache();
  }/**
   * Check Ollama health and model availability*/
  async checkEmbeddingService.Health(): Promise<{
    service: string;
    available: boolean;
    model.Loaded?: boolean;
    version?: string;
    error instanceof Error ? errormessage : String(error)  string;
    recommendations?: string[]}> {
    if (thisuse.Ollama && thisembedding.Service instanceof OllamaEmbedding.Service) {
      const health = await thisembeddingServicecheck.Health();
      const recommendations: string[] = [];
      if (!healthavailable) {
        recommendationspush('Start Ollama: brew install ollama && ollama serve');
        recommendationspush('Or download from: https://ollamaai')} else if (!healthmodel.Loaded) {
        recommendationspush(`Pull the embedding model: ollama pull ${thisembedding.Model}`);
        recommendationspush(
          'Alternative models: ollama pull all-minilm, ollama pull mxbai-embed-large')};

      return {
        service: 'Ollama';
        available: healthavailable;
        model.Loaded: healthmodel.Loaded;
        version: healthversion;
        error instanceof Error ? errormessage : String(error) healtherror;
        recommendations: recommendationslength > 0 ? recommendations : undefined;
      }} else {
      return {
        service: 'OpenA.I';
        available: !!process.envOPENAI_API_KE.Y;
        error instanceof Error ? errormessage : String(error) process.envOPENAI_API_KE.Y? undefined: 'OPENAI_API_KE.Y environment variable not set';
        recommendations: process.envOPENAI_API_KE.Y? undefined: ['Set OPENAI_API_KE.Y environment variable', 'Or switch to Ollama for local embeddings']}}}/**
   * Download/pull an embedding model (Ollama only)*/
  async pullEmbedding.Model(model?: string): Promise<void> {
    if (thisuse.Ollama && thisembedding.Service instanceof OllamaEmbedding.Service) {
      await thisembeddingServicepull.Model(model);
      thisloggerinfo(`Successfully pulled model: ${model || thisembedding.Model}`)} else {
      throw new Error('Model pulling is only available when using Ollama')}}/**
   * List available embedding models (Ollama only)*/
  async listAvailable.Models(): Promise<Array<{ name: string; size: number, modified_at: string }>> {
    if (thisuse.Ollama && thisembedding.Service instanceof OllamaEmbedding.Service) {
      return await thisembeddingServicelist.Models()} else {
      throw new Error('Model listing is only available when using Ollama')}}/**
   * Switch between Ollama and OpenA.I embedding services*/
  switchEmbedding.Service(
    use.Ollama: boolean;
    config?: Embedding.Config | OllamaEmbedding.Config): void {
    thisuse.Ollama = use.Ollama;
    if (use.Ollama) {
      const ollama.Config = config as OllamaEmbedding.Config;
      const model = ollama.Config?model || 'nomic-embed-text';
      const dimensions = ollama.Config?dimensions || (model === 'nomic-embed-text' ? 768 : 768);
      thisembedding.Service = getOllamaEmbedding.Service({
        dimensions;
        maxBatch.Size: 16;
        cacheMax.Size: 10000.ollama.Config;
        model});
      thisembedding.Model = model;
      thisembedding.Dimension = dimensions;
      thisloggerinfo(`Switched to Ollama embedding service (${model}, ${dimensions} dimensions)`)} else {
      const openai.Config = config as Embedding.Config;
      const model = openai.Config?model || 'text-embedding-3-large';
      const dimensions =
        openai.Config?dimensions || (model === 'text-embedding-3-large'? 1536: model === 'text-embedding-3-small'? 1536: 1536);
      thisembedding.Service = new ProductionEmbedding.Service({
        dimensions;
        maxBatch.Size: 32;
        cacheMax.Size: 10000.openai.Config;
        model});
      thisembedding.Model = model;
      thisembedding.Dimension = dimensions;
      thisloggerinfo(`Switched to OpenA.I embedding service (${model}, ${dimensions} dimensions)`)}// Clear caches when switching services due to different dimensions;
    thisclearAll.Caches()}/**
   * Get embedding service information*/
  getEmbeddingService.Info(): {
    service: string;
    model: string;
    dimensions: number;
    use.Ollama: boolean} {
    return {
      service: thisuse.Ollama ? 'Ollama' : 'OpenA.I';
      model: thisembedding.Model;
      dimensions: thisembedding.Dimension;
      use.Ollama: thisuse.Ollama;
    }}/**
   * Get learning insights for an agent*/
  async getLearning.Insights(agent.Name: string): Promise<Learning.Insights> {
    try {
      return await thisaccessLearnergetLearning.Insights(agent.Name)} catch (error) {
      thisloggererror('Failed to get learning insights:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Calculate utility score for a memory*/
  async calculateMemoryUtility.Score(
    memory.Id: string;
    agent.Name: string;
    base.Score: number;
    contextual.Factors?: {
      current.Time?: Date;
      query.Embedding?: number[];
      session.Context?: string;
      urgency?: string;
    }): Promise<Utility.Score> {
    try {
      return await thisaccessLearnercalculateUtility.Score(
        memory.Id;
        agent.Name;
        base.Score;
        contextual.Factors)} catch (error) {
      thisloggererror('Failed to calculate utility score:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Get current adaptive weights for learning*/
  getAdaptive.Weights(): {
    recency.Weight: number;
    frequency.Weight: number;
    similarity.Weight: number;
    importance.Weight: number;
    userFeedback.Weight: number} {
    return thisaccessLearnergetAdaptive.Weights()}/**
   * Perform intelligent search with all enhancements enabled*/
  async intelligent.Search(
    query: string;
    agent.Name: string;
    options: Partial<MemorySearch.Options> = {
}): Promise<{
    results: Memory[];
    query.Enrichment?: any;
    search.Strategy?: string;
    metrics?: Search.Metrics;
    utilityRanking.Applied: boolean}> {
    try {
      // Enable all advanced features by default;
      const search.Options: MemorySearch.Options = {
        query;
        agent.Filter: agent.Name;
        enableMulti.Stage: true;
        enableUtility.Ranking: true;
        record.Access: true;
        search.Strategy: 'balanced';
        max.Results: 10;
        similarity.Threshold: 0.6.options;
      }// Use contextual search if available;
      if (thiscontextual.Enricher) {
        const contextual.Result = await thiscontextual.Search(query, search.Options);
        return {
          results: contextual.Resultresults;
          query.Enrichment: contextualResultquery.Enrichment;
          search.Strategy: contextualResultsearch.Strategy;
          utilityRanking.Applied: !!searchOptionsenableUtility.Ranking;
        }} else {
        // Fallback to multi-stage search;
        if (searchOptionsenableMulti.Stage) {
          const multiStage.Result = await thismultiStageSearch.Memories(search.Options);
          return {
            results: multiStage.Resultresults;
            metrics: multiStage.Resultmetrics;
            utilityRanking.Applied: !!searchOptionsenableUtility.Ranking;
          }} else {
          // Standard search;
          const results = await thissearch.Memories(search.Options);
          return {
            results;
            utilityRanking.Applied: !!searchOptionsenableUtility.Ranking;
          }}}} catch (error) {
      thisloggererror('Failed to perform intelligent search:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Clear all learning data and caches*/
  clearAllLearning.Data(): void {
    thisclearAll.Caches();
    thisaccessLearnerclear.Cache();
  }};

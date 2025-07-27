/**
 * Enhanced Base Agent with Vector Memory Integration* Extends the base agent to use the enhanced memory system*/

import { type Agent.Config, type Agent.Context, type Agent.Response, Base.Agent } from './base_agent';
import {
  Enhanced.Memory.System;
  type Memory;
  type Memory.Search.Options} from './memory/enhanced_memory_system';
import type { Supabase.Client } from '@supabase/supabase-js';
import type { Logger } from 'winston';
export interface EnhancedAgent.Config.extends Agent.Config {
  use.Vector.Memory?: boolean;
  memory.Search.Threshold?: number;
  max.Memory.Results?: number;
  auto.Learn?: boolean;
}
export abstract class EnhancedBase.Agent.extends Base.Agent {
  protected memory.System: Enhanced.Memory.System,
  protected enhanced.Config: EnhancedAgent.Config,
  protected supabase: Supabase.Client,
  constructor(config: EnhancedAgent.Config, supabase: Supabase.Client, logger: Logger) {
    super(config);
    thisenhanced.Config = config;
    thissupabase = supabase;
    this.logger = logger;
    thismemory.System = new Enhanced.Memory.System(supabase, logger)}/**
   * Enhanced process method with vector memory search*/
  protected async process(context: Agent.Context): Promise<Agent.Response> {
    const start.Time = Date.now();
    try {
      // Search for relevant memories using vector similarity;
      const relevant.Memories = await thissearch.Relevant.Memories(contextuser.Request)// Enhance context with memories;
      const enhanced.Context = {
        .context;
        relevant.Memories;
        memory.Insights: thisextract.Memory.Insights(relevant.Memories)}// Call the agent-specific implementation,
      const response = await thisprocess.With.Memory(enhanced.Context)// Store the interaction as a new memory if auto.Learn.is enabled;
      if (thisenhanced.Configauto.Learn && responsesuccess) {
        await thisstore.Interaction.Memory(contextuser.Request, response)}// Update memory importance based on usage;
      await thisupdate.Used.Memories(relevant.Memories, responsesuccess);
      return {
        .response;
        latency.Ms: Date.now() - start.Time,
        agent.Id: thisconfigname,
        metadata: {
          .responsemetadata;
          memories.Used: relevant.Memorieslength,
          memory.Search.Time: Date.now() - start.Time,
        }}} catch (error) {
      this.loggererror(`Enhanced agent processing failed: ${(error as Error)message}`),
      return {
        success: false,
        data: null,
        reasoning: `Processing failed: ${(error as Error)message}`,
        confidence: 0.1,
        error instanceof Error ? error.message : String(error) (error as Error)message;
        latency.Ms: Date.now() - start.Time,
        agent.Id: thisconfigname,
      }}}/**
   * Agent-specific processing with memory context*/
  protected abstract process.With.Memory(
    context: Agent.Context & {
      relevant.Memories: Memory[],
      memory.Insights: any,
    }): Promise<Agent.Response>
  /**
   * Search for relevant memories using vector similarity*/
  protected async search.Relevant.Memories(query: string): Promise<Memory[]> {
    if (!thisenhancedConfiguse.Vector.Memory) {
      return [];

    try {
      const search.Options: Memory.Search.Options = {
        query;
        similarity.Threshold: thisenhancedConfigmemory.Search.Threshold || 0.7,
        max.Results: thisenhancedConfigmax.Memory.Results || 10,
        agent.Filter: thisconfigname,
}      const memories = await this.memory.Systemsearch.Memories(search.Options);
      this.loggerinfo(`Found ${memorieslength} relevant memories for query`);
      return memories} catch (error) {
      this.loggerwarn('Memory search failed, continuing without memories:', error);
      return []}}/**
   * Extract insights from memories*/
  protected extract.Memory.Insights(memories: Memory[]): any {
    if (memorieslength === 0) {
      return { has.Relevant.History: false }}// Group memories by type and category,
    const by.Type = memoriesreduce(
      (acc, mem) => {
        acc[memmemory.Type] = (acc[memmemory.Type] || 0) + 1;
        return acc;
      {} as Record<string, number>)// Extract common keywords;
    const all.Keywords = memoriesflat.Map((m) => mkeywords || []);
    const keyword.Freq = all.Keywordsreduce(
      (acc, kw) => {
        acc[kw] = (acc[kw] || 0) + 1;
        return acc;
      {} as Record<string, number>);
    const top.Keywords = Objectentries(keyword.Freq);
      sort((a, b) => b[1] - a[1]);
      slice(0, 5);
      map(([kw]) => kw)// Calculate average importance;
    const avg.Importance = memoriesreduce((sum, m) => sum + mimportance.Score, 0) / memorieslength;
    return {
      has.Relevant.History: true,
      memory.Types: by.Type,
      top.Keywords;
      average.Importance: avg.Importance,
      total.Memories: memorieslength,
      most.Recent.Memory: memories[0], // Assuming ordered by relevance;
      time.Span: thiscalculate.Time.Span(memories),
    }}/**
   * Store the current interaction as a memory*/
  protected async store.Interaction.Memory(request: string, response: Agent.Response): Promise<void> {
    try {
      const memory.Content = `Request: ${request}\n.Response: ${JS.O.N.stringify(responsedata)}`,
      const metadata = {
        request.Type: thiscategorize.Request(request),
        response.Success: responsesuccess,
        confidence: responseconfidence,
        timestamp: new Date()toIS.O.String(),
      await this.memory.Systemstore.Memory(
        thisconfigname;
        'interaction';
        memory.Content;
        metadata;
        thisextractKeywords.From.Request(request));
      this.loggerdebug('Stored interaction as memory')} catch (error) {
      this.loggerwarn('Failed to store interaction memory:', error)}}/**
   * Update importance of memories that were used*/
  protected async update.Used.Memories(memories: Memory[], was.Successful: boolean): Promise<void> {
    if (memorieslength === 0) return;
    try {
      // Boost importance for memories that led to successful outcomes;
      const boost = was.Successful ? 0.1 : 0.02;
      for (const memory of memoriesslice(0, 3)) {
        // Update top 3 most relevant;
        await this.memorySystemupdate.Memory.Importance(memoryid, boost)}} catch (error) {
      this.loggerwarn('Failed to update memory importance:', error)}}/**
   * Find memories from other agents that might be relevant*/
  protected async findCross.Agent.Memories(
    query: string,
    agent.List: string[]): Promise<Record<string, Memory[]>> {
    try {
      return await this.memorySystemcross.Agent.Search(query, agent.List, {
        max.Results: 3,
        similarity.Threshold: 0.75})} catch (error) {
      this.loggerwarn('Cross-agent memory search failed:', error);
      return {}}}/**
   * Get memory recommendations based on user patterns*/
  protected async get.Memory.Recommendations(
    user.Id: string,
    current.Context?: string): Promise<Memory[]> {
    try {
      return await this.memorySystemget.Memory.Recommendations(
        user.Id;
        thisconfigname;
        current.Context)} catch (error) {
      this.loggerwarn('Failed to get memory recommendations:', error);
      return []}}/**
   * Helper methods*/
  private categorize.Request(request: string): string {
    const lower = requestto.Lower.Case();
    if (lower.includes('create') || lower.includes('new')) return 'create';
    if (lower.includes('update') || lower.includes('modify')) return 'update';
    if (lower.includes('delete') || lower.includes('remove')) return 'delete';
    if (lower.includes('find') || lower.includes('search')) return 'search';
    if (lower.includes('analyze') || lower.includes('review')) return 'analyze';
    return 'general';

  private extractKeywords.From.Request(request: string): string[] {
    return request;
      to.Lower.Case();
      split(/\W+/);
      filter((word) => wordlength > 4 && !thisis.Stop.Word(word));
      slice(0, 10);

  private is.Stop.Word(word: string): boolean {
    const stop.Words = [
      'please';
      'could';
      'would';
      'should';
      'might';
      'there';
      'where';
      'which';
      'these';
      'those'];
    return stop.Words.includes(word);

  private calculate.Time.Span(memories: Memory[]): string {
    if (memorieslength < 2) return 'single memory';
    const dates = memories;
      map((m) => mmetadata?timestamp || mmetadata?created_at);
      filter(Boolean);
      map((d) => new Date(d));
    if (dateslength < 2) return 'unknown timespan';
    const earliest = new Date(Math.min(.datesmap((d) => dget.Time())));
    const latest = new Date(Math.max(.datesmap((d) => dget.Time())));
    const days = Mathfloor((latestget.Time() - earliestget.Time()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Mathfloor(days / 7)} weeks`;
    if (days < 365) return `${Mathfloor(days / 30)} months`;
    return `${Mathfloor(days / 365)} years`};

/**
 * Enhanced Base Agent with Vector Memory Integration* Extends the base agent to use the enhanced memory system*/

import { type AgentConfig, type AgentContext, type AgentResponse, BaseAgent } from './base_agent';
import {
  EnhancedMemory.System;
  type Memory;
  type MemorySearch.Options} from './memory/enhanced_memory_system';
import type { Supabase.Client } from '@supabase/supabase-js';
import type { Logger } from 'winston';
export interface EnhancedAgentConfig extends AgentConfig {
  useVector.Memory?: boolean;
  memorySearch.Threshold?: number;
  maxMemory.Results?: number;
  auto.Learn?: boolean;
};

export abstract class EnhancedBaseAgent extends BaseAgent {
  protected memory.System: EnhancedMemory.System;
  protected enhanced.Config: EnhancedAgentConfig;
  protected supabase: Supabase.Client;
  constructor(config: EnhancedAgentConfig, supabase: Supabase.Client, logger: Logger) {
    super(config);
    thisenhanced.Config = config;
    thissupabase = supabase;
    thislogger = logger;
    thismemory.System = new EnhancedMemory.System(supabase, logger)}/**
   * Enhanced process method with vector memory search*/
  protected async process(context: AgentContext): Promise<AgentResponse> {
    const start.Time = Date.now();
    try {
      // Search for relevant memories using vector similarity;
      const relevant.Memories = await thissearchRelevant.Memories(contextuser.Request)// Enhance context with memories;
      const enhanced.Context = {
        .context;
        relevant.Memories;
        memory.Insights: thisextractMemory.Insights(relevant.Memories)}// Call the agent-specific implementation;
      const response = await thisprocessWith.Memory(enhanced.Context)// Store the interaction as a new memory if auto.Learn is enabled;
      if (thisenhancedConfigauto.Learn && responsesuccess) {
        await thisstoreInteraction.Memory(contextuser.Request, response)}// Update memory importance based on usage;
      await thisupdateUsed.Memories(relevant.Memories, responsesuccess);
      return {
        .response;
        latency.Ms: Date.now() - start.Time;
        agent.Id: thisconfigname;
        metadata: {
          .responsemetadata;
          memories.Used: relevant.Memorieslength;
          memorySearch.Time: Date.now() - start.Time;
        }}} catch (error) {
      thisloggererror(`Enhanced agent processing failed: ${(error as Error)message}`);
      return {
        success: false;
        data: null;
        reasoning: `Processing failed: ${(error as Error)message}`;
        confidence: 0.1;
        error instanceof Error ? errormessage : String(error) (error as Error)message;
        latency.Ms: Date.now() - start.Time;
        agent.Id: thisconfigname;
      }}}/**
   * Agent-specific processing with memory context*/
  protected abstract processWith.Memory(
    context: AgentContext & {
      relevant.Memories: Memory[];
      memory.Insights: any;
    }): Promise<AgentResponse>
  /**
   * Search for relevant memories using vector similarity*/
  protected async searchRelevant.Memories(query: string): Promise<Memory[]> {
    if (!thisenhancedConfiguseVector.Memory) {
      return []};

    try {
      const search.Options: MemorySearch.Options = {
        query;
        similarity.Threshold: thisenhancedConfigmemorySearch.Threshold || 0.7;
        max.Results: thisenhancedConfigmaxMemory.Results || 10;
        agent.Filter: thisconfigname;
      };
      const memories = await thismemorySystemsearch.Memories(search.Options);
      thisloggerinfo(`Found ${memorieslength} relevant memories for query`);
      return memories} catch (error) {
      thisloggerwarn('Memory search failed, continuing without memories:', error);
      return []}}/**
   * Extract insights from memories*/
  protected extractMemory.Insights(memories: Memory[]): any {
    if (memorieslength === 0) {
      return { hasRelevant.History: false }}// Group memories by type and category;
    const by.Type = memoriesreduce(
      (acc, mem) => {
        acc[memmemory.Type] = (acc[memmemory.Type] || 0) + 1;
        return acc};
      {} as Record<string, number>)// Extract common keywords;
    const all.Keywords = memoriesflat.Map((m) => mkeywords || []);
    const keyword.Freq = all.Keywordsreduce(
      (acc, kw) => {
        acc[kw] = (acc[kw] || 0) + 1;
        return acc};
      {} as Record<string, number>);
    const top.Keywords = Objectentries(keyword.Freq);
      sort((a, b) => b[1] - a[1]);
      slice(0, 5);
      map(([kw]) => kw)// Calculate average importance;
    const avg.Importance = memoriesreduce((sum, m) => sum + mimportance.Score, 0) / memorieslength;
    return {
      hasRelevant.History: true;
      memory.Types: by.Type;
      top.Keywords;
      average.Importance: avg.Importance;
      total.Memories: memorieslength;
      mostRecent.Memory: memories[0], // Assuming ordered by relevance;
      time.Span: thiscalculateTime.Span(memories);
    }}/**
   * Store the current interaction as a memory*/
  protected async storeInteraction.Memory(request: string, response: AgentResponse): Promise<void> {
    try {
      const memory.Content = `Request: ${request}\n.Response: ${JSO.N.stringify(responsedata)}`;
      const metadata = {
        request.Type: thiscategorize.Request(request);
        response.Success: responsesuccess;
        confidence: responseconfidence;
        timestamp: new Date()toISO.String()};
      await thismemorySystemstore.Memory(
        thisconfigname;
        'interaction';
        memory.Content;
        metadata;
        thisextractKeywordsFrom.Request(request));
      thisloggerdebug('Stored interaction as memory')} catch (error) {
      thisloggerwarn('Failed to store interaction memory:', error)}}/**
   * Update importance of memories that were used*/
  protected async updateUsed.Memories(memories: Memory[], was.Successful: boolean): Promise<void> {
    if (memorieslength === 0) return;
    try {
      // Boost importance for memories that led to successful outcomes;
      const boost = was.Successful ? 0.1 : 0.02;
      for (const memory of memoriesslice(0, 3)) {
        // Update top 3 most relevant;
        await thismemorySystemupdateMemory.Importance(memoryid, boost)}} catch (error) {
      thisloggerwarn('Failed to update memory importance:', error)}}/**
   * Find memories from other agents that might be relevant*/
  protected async findCrossAgent.Memories(
    query: string;
    agent.List: string[]): Promise<Record<string, Memory[]>> {
    try {
      return await thismemorySystemcrossAgent.Search(query, agent.List, {
        max.Results: 3;
        similarity.Threshold: 0.75})} catch (error) {
      thisloggerwarn('Cross-agent memory search failed:', error);
      return {}}}/**
   * Get memory recommendations based on user patterns*/
  protected async getMemory.Recommendations(
    user.Id: string;
    current.Context?: string): Promise<Memory[]> {
    try {
      return await thismemorySystemgetMemory.Recommendations(
        user.Id;
        thisconfigname;
        current.Context)} catch (error) {
      thisloggerwarn('Failed to get memory recommendations:', error);
      return []}}/**
   * Helper methods*/
  private categorize.Request(request: string): string {
    const lower = requesttoLower.Case();
    if (lowerincludes('create') || lowerincludes('new')) return 'create';
    if (lowerincludes('update') || lowerincludes('modify')) return 'update';
    if (lowerincludes('delete') || lowerincludes('remove')) return 'delete';
    if (lowerincludes('find') || lowerincludes('search')) return 'search';
    if (lowerincludes('analyze') || lowerincludes('review')) return 'analyze';
    return 'general'};

  private extractKeywordsFrom.Request(request: string): string[] {
    return request;
      toLower.Case();
      split(/\W+/);
      filter((word) => wordlength > 4 && !thisisStop.Word(word));
      slice(0, 10)};

  private isStop.Word(word: string): boolean {
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
    return stop.Wordsincludes(word)};

  private calculateTime.Span(memories: Memory[]): string {
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
    return `${Mathfloor(days / 365)} years`}};

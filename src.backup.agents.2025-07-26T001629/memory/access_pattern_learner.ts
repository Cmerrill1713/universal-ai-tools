/**
 * Memory Access Pattern Learning System* Learns from user behavior to improve search relevance and memory importance* Implements utility-based re-ranking and adaptive scoring*/

import type { Supabase.Client } from '@supabase/supabase-js';
import type { Logger } from 'winston';
export interface Access.Pattern {
  id: string;
  memory.Id: string;
  agent.Name: string;
  access.Type: 'search' | 'direct' | 'related' | 'contextual';
  query.Embedding?: number[];
  similarity.Score?: number;
  response.Useful?: boolean;
  interaction.Duration?: number;
  followUp.Queries?: string[];
  timestamp: Date;
  user.Feedback?: {
    relevance: number// 1-5 scale;
    helpfulness: number// 1-5 scale;
    accuracy: number// 1-5 scale};
  contextual.Factors?: {
    timeOf.Day: number// 0-23;
    session.Length: number// minutes;
    task.Type?: string;
    urgency?: 'low' | 'medium' | 'high' | 'critical';
  }};

export interface Utility.Score {
  base.Score: number;
  recency.Boost: number;
  frequency.Boost: number;
  userPreference.Boost: number;
  contextualRelevance.Boost: number;
  final.Score: number;
  explanation: string[];
};

export interface Learning.Insights {
  user.Preferences: {
    preferredMemory.Types: Array<{ type: string, weight: number }>
    preferred.Agents: Array<{ agent: string, weight: number }>
    timeOfDay.Patterns: Array<{ hour: number, activity: number }>
    averageSession.Length: number;
  };
  search.Patterns: {
    common.Queries: Array<{ query: string, frequency: number }>
    failure.Patterns: Array<{ _pattern string, reason: string }>
    success.Factors: Array<{ factor: string, impact: number }>};
  adaptive.Weights: {
    recency.Weight: number;
    frequency.Weight: number;
    similarity.Weight: number;
    importance.Weight: number;
    userFeedback.Weight: number;
  };
  recommendations: string[];
}/**
 * Advanced access _patternlearning system*/
export class AccessPattern.Learner {
  private supabase: Supabase.Client;
  private logger: Logger;
  private learning.Cache = new Map<string, any>();
  private readonly CACHE_TT.L = 30 * 60 * 1000// 30 minutes// Learning parameters;
  private adaptive.Weights = {
    recency.Weight: 0.2;
    frequency.Weight: 0.25;
    similarity.Weight: 0.3;
    importance.Weight: 0.15;
    userFeedback.Weight: 0.1;
  };
  constructor(supabase: Supabase.Client, logger: Logger) {
    thissupabase = supabase;
    thislogger = logger;
  }/**
   * Record memory access pattern*/
  async record.Access(
    memory.Id: string;
    agent.Name: string;
    access.Type: Access.Pattern['access.Type'];
    options: {
      query.Embedding?: number[];
      similarity.Score?: number;
      response.Useful?: boolean;
      interaction.Duration?: number;
      contextual.Factors?: Access.Pattern['contextual.Factors']} = {}): Promise<void> {
    try {
      const access.Pattern: Omit<Access.Pattern, 'id'> = {
        memory.Id;
        agent.Name;
        access.Type;
        query.Embedding: optionsquery.Embedding;
        similarity.Score: optionssimilarity.Score;
        response.Useful: optionsresponse.Useful;
        interaction.Duration: optionsinteraction.Duration;
        timestamp: new Date();
        contextual.Factors: {
          timeOf.Day: new Date()get.Hours();
          session.Length: optionscontextual.Factors?session.Length || 0;
          task.Type: optionscontextual.Factors?task.Type;
          urgency: optionscontextual.Factors?urgency;
        }};
      const { error instanceof Error ? errormessage : String(error)  = await thissupabasefrom('memory_access_patterns')insert(access.Pattern);
      if (error instanceof Error ? errormessage : String(error) throw error instanceof Error ? errormessage : String(error)// Update memory access count and last accessed time;
      await thisupdateMemory.Stats(memory.Id, optionsresponse.Useful)// Invalidate learning cache for this agent;
      thislearning.Cachedelete(`insights:${agent.Name}`)} catch (error) {
      thisloggererror('Failed to record access _pattern', error instanceof Error ? errormessage : String(error)  }}/**
   * Record user feedback for a memory interaction*/
  async recordUser.Feedback(
    memory.Id: string;
    agent.Name: string;
    feedback: Access.Pattern['user.Feedback'];
    followUp.Queries?: string[]): Promise<void> {
    try {
      // Find the most recent access _patternfor this memory and agent;
      const { data: recent.Access, error instanceof Error ? errormessage : String(error)  = await thissupabase;
        from('memory_access_patterns');
        select('*');
        eq('memory_id', memory.Id);
        eq('agent_name', agent.Name);
        order('created_at', { ascending: false });
        limit(1);
        single();
      if (error instanceof Error ? errormessage : String(error) throw error instanceof Error ? errormessage : String(error)// Update the access _patternwith feedback;
      await thissupabase;
        from('memory_access_patterns');
        update({
          user_feedback: feedback;
          follow_up_queries: followUp.Queries;
          response_useful: feedback?relevance ? feedbackrelevance >= 3 : null, // 3+ out of 5 is considered useful});
        eq('id', recent.Accessid)// Update adaptive weights based on feedback;
      await thisupdateAdaptive.Weights(agent.Name, feedback);
      thisloggerinfo(
        `Recorded user feedback for memory ${memory.Id}: relevance=${feedback?relevance}, helpfulness=${feedback?helpfulness}`)} catch (error) {
      thisloggererror('Failed to record user feedback:', error instanceof Error ? errormessage : String(error)  }}/**
   * Calculate utility-based score for memory re-ranking*/
  async calculateUtility.Score(
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
      const current.Time = contextual.Factors?current.Time || new Date();
      const explanation: string[] = []// Get memory access history;
      const { data: access.History } = await thissupabase;
        from('memory_access_patterns');
        select('*');
        eq('memory_id', memory.Id);
        eq('agent_name', agent.Name);
        order('created_at', { ascending: false });
        limit(50);
      const access.Count = access.History?length || 0;
      const recent.Accesses =
        access.History?filter(
          (a) => new Date(acreated_at)get.Time() > currentTimeget.Time() - 7 * 24 * 60 * 60 * 1000) || []// Calculate recency boost;
      let recency.Boost = 0;
      if (recent.Accesseslength > 0) {
        const last.Access = new Date(recent.Accesses[0]created_at);
        const daysSince.Access =
          (currentTimeget.Time() - lastAccessget.Time()) / (24 * 60 * 60 * 1000);
        recency.Boost = Math.max(0, (7 - daysSince.Access) / 7) * thisadaptiveWeightsrecency.Weight;
        explanationpush(
          `Recency: +${(recency.Boost * 100)to.Fixed(1)}% (last accessed ${daysSinceAccessto.Fixed(1)} days ago)`)}// Calculate frequency boost;
      let frequency.Boost = 0;
      if (access.Count > 0) {
        const frequency.Score = Math.min(access.Count / 10, 1)// Normalize to 0-1;
        frequency.Boost = frequency.Score * thisadaptiveWeightsfrequency.Weight;
        explanationpush(
          `Frequency: +${(frequency.Boost * 100)to.Fixed(1)}% (${access.Count} accesses)`)}// Calculate user preference boost;
      let userPreference.Boost = 0;
      const positive.Interactions =
        access.History?filter((a) => aresponse_useful === true)length || 0;
      if (access.Count > 0) {
        const success.Rate = positive.Interactions / access.Count;
        userPreference.Boost = success.Rate * thisadaptiveWeightsuserFeedback.Weight;
        explanationpush(
          `User preference: +${(userPreference.Boost * 100)to.Fixed(1)}% (${(success.Rate * 100)to.Fixed(1)}% success rate)`)}// Calculate contextual relevance boost;
      let contextualRelevance.Boost = 0;
      if (contextual.Factors?urgency) {
        const urgency.Multipliers = { low: 0.8, medium: 1.0, high: 1.2, critical: 1.5 };
        const urgency.Multiplier =
          urgency.Multipliers[contextual.Factorsurgency as keyof typeof urgency.Multipliers] || 1.0;
        contextualRelevance.Boost = (urgency.Multiplier - 1) * 0.1;
        explanationpush(
          `Urgency (${contextual.Factorsurgency}): ${contextualRelevance.Boost >= 0 ? '+' : ''}${(contextualRelevance.Boost * 100)to.Fixed(1)}%`)}// Time-of-day patterns;
      const current.Hour = currentTimeget.Hours();
      const hourly.Accesses =
        access.History?filter((a) => new Date(acreated_at)get.Hours() === current.Hour)length || 0;
      if (hourly.Accesses > 0) {
        const time.Boost = Math.min(hourly.Accesses / access.Count, 0.2);
        contextualRelevance.Boost += time.Boost;
        explanationpush(`Time _pattern +${(time.Boost * 100)to.Fixed(1)}% (active at this hour)`)};

      const final.Score = Math.min(
        1.0;
        Math.max(
          0.0;
          base.Score + recency.Boost + frequency.Boost + userPreference.Boost + contextualRelevance.Boost));
      return {
        base.Score;
        recency.Boost;
        frequency.Boost;
        userPreference.Boost;
        contextualRelevance.Boost;
        final.Score;
        explanation}} catch (error) {
      thisloggererror('Failed to calculate utility score:', error instanceof Error ? errormessage : String(error);
      return {
        base.Score;
        recency.Boost: 0;
        frequency.Boost: 0;
        userPreference.Boost: 0;
        contextualRelevance.Boost: 0;
        final.Score: base.Score;
        explanation: ['Error calculating utility score'];
      }}}/**
   * Re-rank search results based on learned patterns*/
  async reRank.Results(
    results: Array<{
      id: string;
      similarity.Score: number;
      importance.Score: number;
      [key: string]: any}>
    agent.Name: string;
    contextual.Factors?: {
      query.Embedding?: number[];
      session.Context?: string;
      urgency?: string;
    }): Promise<
    Array<{
      id: string;
      original.Rank: number;
      new.Rank: number;
      utility.Score: Utility.Score;
      [key: string]: any}>
  > {
    try {
      const ranked.Results = await Promiseall(
        resultsmap(async (result, index) => {
          const utility.Score = await thiscalculateUtility.Score(
            resultid;
            agent.Name;
            resultsimilarity.Score;
            {
              query.Embedding: contextual.Factors?query.Embedding;
              urgency: contextual.Factors?urgency;
            });
          return {
            .result;
            original.Rank: index;
            utility.Score;
            final.Score: utilityScorefinal.Score;
          }}))// Re-sort by utility score;
      ranked.Resultssort((a, b) => bfinal.Score - afinal.Score)// Add new ranks;
      return ranked.Resultsmap((result, new.Index) => ({
        .result;
        new.Rank: new.Index}))} catch (error) {
      thisloggererror('Failed to re-rank results:', error instanceof Error ? errormessage : String(error)// Return original results with utility scores of 0;
      return resultsmap((result, index) => ({
        .result;
        original.Rank: index;
        new.Rank: index;
        utility.Score: {
          base.Score: resultsimilarity.Score;
          recency.Boost: 0;
          frequency.Boost: 0;
          userPreference.Boost: 0;
          contextualRelevance.Boost: 0;
          final.Score: resultsimilarity.Score;
          explanation: ['Error calculating utility score'];
        }}))}}/**
   * Get learning insights for an agent*/
  async getLearning.Insights(agent.Name: string): Promise<Learning.Insights> {
    try {
      const cache.Key = `insights:${agent.Name}`;
      const cached = thislearning.Cacheget(cache.Key);
      if (cached && Date.now() - cachedtimestamp < thisCACHE_TT.L) {
        return cacheddata};

      const insights = await thisgenerateLearning.Insights(agent.Name);
      thislearning.Cacheset(cache.Key, {
        data: insights;
        timestamp: Date.now()});
      return insights} catch (error) {
      thisloggererror('Failed to get learning insights:', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Update adaptive weights based on user feedback*/
  private async updateAdaptive.Weights(
    agent.Name: string;
    feedback: Access.Pattern['user.Feedback']): Promise<void> {
    try {
      // Get recent feedback for this agent;
      const { data: recent.Feedback } = await thissupabase;
        from('memory_access_patterns');
        select('user_feedback, similarity_score, response_useful');
        eq('agent_name', agent.Name);
        not('user_feedback', 'is', null);
        order('created_at', { ascending: false });
        limit(100);
      if (!recent.Feedback || recent.Feedbacklength < 10) return// Analyze correlations between scores and user satisfaction;
      let similarity.Correlation = 0;
      let responseUseful.Correlation = 0;
      let total.Samples = 0;
      recentFeedbackfor.Each((item) => {
        if (itemuser_feedback) {
          const satisfaction = (itemuser_feedbackrelevance + itemuser_feedbackhelpfulness) / 2;
          if (itemsimilarity_score) {
            similarity.Correlation += (itemsimilarity_score - 0.5) * (satisfaction - 3)};

          if (itemresponse_useful !== null) {
            responseUseful.Correlation += (itemresponse_useful ? 1 : 0) * (satisfaction - 3);
          };

          total.Samples++}})// Adjust weights based on correlations;
      if (total.Samples > 0) {
        similarity.Correlation /= total.Samples;
        responseUseful.Correlation /= total.Samples// Gradually adjust weights (learning rate = 0.1);
        const learning.Rate = 0.1;
        if (similarity.Correlation > 0.1) {
          thisadaptiveWeightssimilarity.Weight += learning.Rate * 0.05;
          thisadaptiveWeightsfrequency.Weight -= learning.Rate * 0.025} else if (similarity.Correlation < -0.1) {
          thisadaptiveWeightssimilarity.Weight -= learning.Rate * 0.05;
          thisadaptiveWeightsfrequency.Weight += learning.Rate * 0.025}// Normalize weights to sum to 1;
        const total.Weight = Objectvalues(thisadaptive.Weights)reduce(
          (sum, weight) => sum + weight;
          0);
        Objectkeys(thisadaptive.Weights)for.Each((key) => {
          thisadaptive.Weights[key as keyof typeof thisadaptive.Weights] /= total.Weight});
        thisloggerdebug(`Updated adaptive weights for ${agent.Name}:`, thisadaptive.Weights)}} catch (error) {
      thisloggererror('Failed to update adaptive weights:', error instanceof Error ? errormessage : String(error)  }}/**
   * Generate comprehensive learning insights*/
  private async generateLearning.Insights(agent.Name: string): Promise<Learning.Insights> {
    try {
      // Get access patterns for the last 30 days;
      const thirtyDays.Ago = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { data: access.Patterns } = await thissupabase;
        from('memory_access_patterns');
        select(
          `*
          ai_memories!memory_access_patterns_memory_id_fkey (
            service_id;
            memory_type;
            importance_score);
        ``);
        eq('agent_name', agent.Name);
        gte('created_at', thirtyDaysAgotoISO.String());
      if (!access.Patterns || access.Patternslength === 0) {
        return thisgetDefault.Insights()}// Analyze user preferences;
      const memory.Types = new Map<string, { count: number, avg.Satisfaction: number }>();
      const agents = new Map<string, { count: number, avg.Satisfaction: number }>();
      const hourly.Activity = new Array(24)fill(0);
      const common.Queries = new Map<string, number>();
      let totalSession.Length = 0;
      let session.Count = 0;
      accessPatternsfor.Each((_pattern => {
        // Memory type preferences;
        const memory.Type = _patternai_memories?memory_type || 'unknown';
        const satisfaction = _patternuser_feedback? (_patternuser_feedbackrelevance + _patternuser_feedbackhelpfulness) / 2: 3;
        const type.Data = memory.Typesget(memory.Type) || { count: 0, avg.Satisfaction: 0 };
        type.Datacount++
        typeDataavg.Satisfaction =
          (typeDataavg.Satisfaction * (type.Datacount - 1) + satisfaction) / type.Datacount;
        memory.Typesset(memory.Type, type.Data)// Agent preferences;
        const agent.Id = _patternai_memories?service_id || agent.Name;
        const agent.Data = agentsget(agent.Id) || { count: 0, avg.Satisfaction: 0 };
        agent.Datacount++
        agentDataavg.Satisfaction =
          (agentDataavg.Satisfaction * (agent.Datacount - 1) + satisfaction) / agent.Datacount;
        agentsset(agent.Id, agent.Data)// Time patterns;
        const hour = new Date(_patterncreated_at)get.Hours();
        hourly.Activity[hour]++
        // Session length;
        if (_patterncontextual_factors?session.Length) {
          totalSession.Length += _patterncontextual_factorssession.Length;
          session.Count++}// Follow-up queries;
        if (_patternfollow_up_queries) {
          _patternfollow_up_queriesfor.Each((query: string) => {
            common.Queriesset(query, (common.Queriesget(query) || 0) + 1)})}})// Generate recommendations;
      const recommendations: string[] = [];
      const avg.Satisfaction =
        access.Patterns;
          filter((p) => puser_feedback);
          reduce(
            (sum, p) => sum + (puser_feedbackrelevance + puser_feedbackhelpfulness) / 2;
            0) / access.Patternsfilter((p) => puser_feedback)length;
      if (avg.Satisfaction < 3) {
        recommendationspush(
          'Consider improving memory relevance - user satisfaction is below average')};

      const success.Rate =
        access.Patternsfilter((p) => presponse_useful)length / access.Patternslength;
      if (success.Rate < 0.7) {
        recommendationspush('Focus on memory quality - response usefulness could be improved')};

      if (recommendationslength === 0) {
        recommendationspush('Learning patterns look good - continue current approach')};

      return {
        user.Preferences: {
          preferredMemory.Types: Arrayfrom(memory.Typesentries());
            map(([type, data]) => ({ type, weight: dataavg.Satisfaction * datacount }));
            sort((a, b) => bweight - aweight);
            slice(0, 5);
          preferred.Agents: Arrayfrom(agentsentries());
            map(([agent, data]) => ({ agent, weight: dataavg.Satisfaction * datacount }));
            sort((a, b) => bweight - aweight);
            slice(0, 5);
          timeOfDay.Patterns: hourly.Activity;
            map((activity, hour) => ({ hour, activity }));
            filter((item) => itemactivity > 0);
          averageSession.Length: session.Count > 0 ? totalSession.Length / session.Count : 0;
        };
        search.Patterns: {
          common.Queries: Arrayfrom(common.Queriesentries());
            map(([query, frequency]) => ({ query, frequency }));
            sort((a, b) => bfrequency - afrequency);
            slice(0, 10);
          failure.Patterns: [], // Would need more sophisticated analysis;
          success.Factors: [
            { factor: 'High similarity score', impact: thisadaptiveWeightssimilarity.Weight };
            { factor: 'Recent access', impact: thisadaptiveWeightsrecency.Weight };
            { factor: 'Frequent use', impact: thisadaptiveWeightsfrequency.Weight }]};
        adaptive.Weights: { .thisadaptive.Weights };
        recommendations}} catch (error) {
      thisloggererror('Failed to generate learning insights:', error instanceof Error ? errormessage : String(error);
      return thisgetDefault.Insights()}};

  private async updateMemory.Stats(memory.Id: string, response.Useful?: boolean): Promise<void> {
    try {
      const update.Data: any = {
        last_accessed: new Date()toISO.String();
      }// Increment access count;
      const { data: current.Memory } = await thissupabase;
        from('ai_memories');
        select('access_count, importance_score');
        eq('id', memory.Id);
        single();
      if (current.Memory) {
        update.Dataaccess_count = (current.Memoryaccess_count || 0) + 1// Adjust importance based on usefulness;
        if (response.Useful === true) {
          update.Dataimportance_score = Math.min(1.0, current.Memoryimportance_score + 0.01)} else if (response.Useful === false) {
          update.Dataimportance_score = Math.max(0.0, current.Memoryimportance_score - 0.005)}};

      await thissupabasefrom('ai_memories')update(update.Data)eq('id', memory.Id)} catch (error) {
      thisloggerwarn('Failed to update memory stats:', error instanceof Error ? errormessage : String(error)  }};

  private getDefault.Insights(): Learning.Insights {
    return {
      user.Preferences: {
        preferredMemory.Types: [];
        preferred.Agents: [];
        timeOfDay.Patterns: [];
        averageSession.Length: 0;
      };
      search.Patterns: {
        common.Queries: [];
        failure.Patterns: [];
        success.Factors: [];
      };
      adaptive.Weights: { .thisadaptive.Weights };
      recommendations: ['Collect more usage data to generate personalized insights'];
    }}/**
   * Clear learning cache*/
  clear.Cache(): void {
    thislearning.Cacheclear();
  }/**
   * Get current adaptive weights*/
  getAdaptive.Weights(): typeof thisadaptive.Weights {
    return { .thisadaptive.Weights }}}// Singleton instance;
let globalAccess.Learner: AccessPattern.Learner | null = null;
export function getAccessPattern.Learner(
  supabase: Supabase.Client;
  logger: Logger): AccessPattern.Learner {
  if (!globalAccess.Learner) {
    globalAccess.Learner = new AccessPattern.Learner(supabase, logger)};
  return globalAccess.Learner};

export function resetAccessPattern.Learner(): void {
  globalAccess.Learner = null};

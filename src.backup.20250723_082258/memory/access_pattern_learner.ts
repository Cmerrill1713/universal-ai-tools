/**
 * Memory Access Pattern Learning System
 * Learns from user behavior to improve search relevance and memory importance
 * Implements utility-based re-ranking and adaptive scoring
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';

export interface AccessPattern {
  id: string;
  memoryId: string;
  agentName: string;
  accessType: 'search' | 'direct' | 'related' | 'contextual';
  queryEmbedding?: number[];
  similarityScore?: number;
  responseUseful?: boolean;
  interactionDuration?: number;
  followUpQueries?: string[];
  timestamp: Date;
  userFeedback?: {
    relevance: number; // 1-5 scale
    helpfulness: number; // 1-5 scale
    accuracy: number; // 1-5 scale
  };
  contextualFactors?: {
    timeOfDay: number; // 0-23
    sessionLength: number; // minutes
    taskType?: string;
    urgency?: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface UtilityScore {
  baseScore: number;
  recencyBoost: number;
  frequencyBoost: number;
  userPreferenceBoost: number;
  contextualRelevanceBoost: number;
  finalScore: number;
  explanation: string[];
}

export interface LearningInsights {
  userPreferences: {
    preferredMemoryTypes: Array<{ type: string; weight: number }>;
    preferredAgents: Array<{ agent: string; weight: number }>;
    timeOfDayPatterns: Array<{ hour: number; activity: number }>;
    averageSessionLength: number;
  };
  searchPatterns: {
    commonQueries: Array<{ query: string; frequency: number }>;
    failurePatterns: Array<{ _pattern string; reason: string }>;
    successFactors: Array<{ factor: string; impact: number }>;
  };
  adaptiveWeights: {
    recencyWeight: number;
    frequencyWeight: number;
    similarityWeight: number;
    importanceWeight: number;
    userFeedbackWeight: number;
  };
  recommendations: string[];
}

/**
 * Advanced access _patternlearning system
 */
export class AccessPatternLearner {
  private supabase: SupabaseClient;
  private logger: Logger;
  private learningCache = new Map<string, any>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  // Learning parameters
  private adaptiveWeights = {
    recencyWeight: 0.2,
    frequencyWeight: 0.25,
    similarityWeight: 0.3,
    importanceWeight: 0.15,
    userFeedbackWeight: 0.1,
  };

  constructor(supabase: SupabaseClient, logger: Logger) {
    this.supabase = supabase;
    this.logger = logger;
  }

  /**
   * Record memory access pattern
   */
  async recordAccess(
    memoryId: string,
    agentName: string,
    accessType: AccessPattern['accessType'],
    options: {
      queryEmbedding?: number[];
      similarityScore?: number;
      responseUseful?: boolean;
      interactionDuration?: number;
      contextualFactors?: AccessPattern['contextualFactors'];
    } = {}
  ): Promise<void> {
    try {
      const accessPattern: Omit<AccessPattern, 'id'> = {
        memoryId,
        agentName,
        accessType,
        queryEmbedding: options.queryEmbedding,
        similarityScore: options.similarityScore,
        responseUseful: options.responseUseful,
        interactionDuration: options.interactionDuration,
        timestamp: new Date(),
        contextualFactors: {
          timeOfDay: new Date().getHours(),
          sessionLength: options.contextualFactors?.sessionLength || 0,
          taskType: options.contextualFactors?.taskType,
          urgency: options.contextualFactors?.urgency,
        },
      };

      const { _error} = await this.supabase.from('memory_access_patterns').insert(accessPattern);

      if (_error throw _error;

      // Update memory access count and last accessed time
      await this.updateMemoryStats(memoryId, options.responseUseful);

      // Invalidate learning cache for this agent
      this.learningCache.delete(`insights:${agentName}`);
    } catch (_error) {
      this.logger.error'Failed to record access _pattern', _error;
    }
  }

  /**
   * Record user feedback for a memory interaction
   */
  async recordUserFeedback(
    memoryId: string,
    agentName: string,
    feedback: AccessPattern['userFeedback'],
    followUpQueries?: string[]
  ): Promise<void> {
    try {
      // Find the most recent access _patternfor this memory and agent
      const { data: recentAccess, _error} = await this.supabase
        .from('memory_access_patterns')
        .select('*')
        .eq('memory_id', memoryId)
        .eq('agent_name', agentName)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (_error throw _error;

      // Update the access _patternwith feedback
      await this.supabase
        .from('memory_access_patterns')
        .update({
          user_feedback: feedback,
          follow_up_queries: followUpQueries,
          response_useful: feedback?.relevance ? feedback.relevance >= 3 : null, // 3+ out of 5 is considered useful
        })
        .eq('id', recentAccess.id);

      // Update adaptive weights based on feedback
      await this.updateAdaptiveWeights(agentName, feedback);

      this.logger.info(
        `Recorded user feedback for memory ${memoryId}: relevance=${feedback?.relevance}, helpfulness=${feedback?.helpfulness}`
      );
    } catch (_error) {
      this.logger.error'Failed to record user feedback:', _error;
    }
  }

  /**
   * Calculate utility-based score for memory re-ranking
   */
  async calculateUtilityScore(
    memoryId: string,
    agentName: string,
    baseScore: number,
    contextualFactors?: {
      currentTime?: Date;
      queryEmbedding?: number[];
      sessionContext?: string;
      urgency?: string;
    }
  ): Promise<UtilityScore> {
    try {
      const currentTime = contextualFactors?.currentTime || new Date();
      const explanation: string[] = [];

      // Get memory access history
      const { data: accessHistory } = await this.supabase
        .from('memory_access_patterns')
        .select('*')
        .eq('memory_id', memoryId)
        .eq('agent_name', agentName)
        .order('created_at', { ascending: false })
        .limit(50);

      const accessCount = accessHistory?.length || 0;
      const recentAccesses =
        accessHistory?.filter(
          (a) => new Date(a.created_at).getTime() > currentTime.getTime() - 7 * 24 * 60 * 60 * 1000
        ) || [];

      // Calculate recency boost
      let recencyBoost = 0;
      if (recentAccesses.length > 0) {
        const lastAccess = new Date(recentAccesses[0].created_at);
        const daysSinceAccess =
          (currentTime.getTime() - lastAccess.getTime()) / (24 * 60 * 60 * 1000);
        recencyBoost = Math.max(0, (7 - daysSinceAccess) / 7) * this.adaptiveWeights.recencyWeight;
        explanation.push(
          `Recency: +${(recencyBoost * 100).toFixed(1)}% (last accessed ${daysSinceAccess.toFixed(1)} days ago)`
        );
      }

      // Calculate frequency boost
      let frequencyBoost = 0;
      if (accessCount > 0) {
        const frequencyScore = Math.min(accessCount / 10, 1); // Normalize to 0-1
        frequencyBoost = frequencyScore * this.adaptiveWeights.frequencyWeight;
        explanation.push(
          `Frequency: +${(frequencyBoost * 100).toFixed(1)}% (${accessCount} accesses)`
        );
      }

      // Calculate user preference boost
      let userPreferenceBoost = 0;
      const positiveInteractions =
        accessHistory?.filter((a) => a.response_useful === true).length || 0;
      if (accessCount > 0) {
        const successRate = positiveInteractions / accessCount;
        userPreferenceBoost = successRate * this.adaptiveWeights.userFeedbackWeight;
        explanation.push(
          `User preference: +${(userPreferenceBoost * 100).toFixed(1)}% (${(successRate * 100).toFixed(1)}% success rate)`
        );
      }

      // Calculate contextual relevance boost
      let contextualRelevanceBoost = 0;
      if (contextualFactors?.urgency) {
        const urgencyMultipliers = { low: 0.8, medium: 1.0, high: 1.2, critical: 1.5 };
        const urgencyMultiplier =
          urgencyMultipliers[contextualFactors.urgency as keyof typeof urgencyMultipliers] || 1.0;
        contextualRelevanceBoost = (urgencyMultiplier - 1) * 0.1;
        explanation.push(
          `Urgency (${contextualFactors.urgency}): ${contextualRelevanceBoost >= 0 ? '+' : ''}${(contextualRelevanceBoost * 100).toFixed(1)}%`
        );
      }

      // Time-of-day patterns
      const currentHour = currentTime.getHours();
      const hourlyAccesses =
        accessHistory?.filter((a) => new Date(a.created_at).getHours() === currentHour).length || 0;
      if (hourlyAccesses > 0) {
        const timeBoost = Math.min(hourlyAccesses / accessCount, 0.2);
        contextualRelevanceBoost += timeBoost;
        explanation.push(`Time _pattern +${(timeBoost * 100).toFixed(1)}% (active at this hour)`);
      }

      const finalScore = Math.min(
        1.0,
        Math.max(
          0.0,
          baseScore + recencyBoost + frequencyBoost + userPreferenceBoost + contextualRelevanceBoost
        )
      );

      return {
        baseScore,
        recencyBoost,
        frequencyBoost,
        userPreferenceBoost,
        contextualRelevanceBoost,
        finalScore,
        explanation,
      };
    } catch (_error) {
      this.logger.error'Failed to calculate utility score:', _error;
      return {
        baseScore,
        recencyBoost: 0,
        frequencyBoost: 0,
        userPreferenceBoost: 0,
        contextualRelevanceBoost: 0,
        finalScore: baseScore,
        explanation: ['Error calculating utility score'],
      };
    }
  }

  /**
   * Re-rank search results based on learned patterns
   */
  async reRankResults(
    results: Array<{
      id: string;
      similarityScore: number;
      importanceScore: number;
      [key: string]: any;
    }>,
    agentName: string,
    contextualFactors?: {
      queryEmbedding?: number[];
      sessionContext?: string;
      urgency?: string;
    }
  ): Promise<
    Array<{
      id: string;
      originalRank: number;
      newRank: number;
      utilityScore: UtilityScore;
      [key: string]: any;
    }>
  > {
    try {
      const rankedResults = await Promise.all(
        results.map(async (result, index) => {
          const utilityScore = await this.calculateUtilityScore(
            result.id,
            agentName,
            result.similarityScore,
            {
              queryEmbedding: contextualFactors?.queryEmbedding,
              urgency: contextualFactors?.urgency,
            }
          );

          return {
            ...result,
            originalRank: index,
            utilityScore,
            finalScore: utilityScore.finalScore,
          };
        })
      );

      // Re-sort by utility score
      rankedResults.sort((a, b) => b.finalScore - a.finalScore);

      // Add new ranks
      return rankedResults.map((result, newIndex) => ({
        ...result,
        newRank: newIndex,
      }));
    } catch (_error) {
      this.logger.error'Failed to re-rank results:', _error;
      // Return original results with utility scores of 0
      return results.map((result, index) => ({
        ...result,
        originalRank: index,
        newRank: index,
        utilityScore: {
          baseScore: result.similarityScore,
          recencyBoost: 0,
          frequencyBoost: 0,
          userPreferenceBoost: 0,
          contextualRelevanceBoost: 0,
          finalScore: result.similarityScore,
          explanation: ['Error calculating utility score'],
        },
      }));
    }
  }

  /**
   * Get learning insights for an agent
   */
  async getLearningInsights(agentName: string): Promise<LearningInsights> {
    try {
      const cacheKey = `insights:${agentName}`;
      const cached = this.learningCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      const insights = await this.generateLearningInsights(agentName);

      this.learningCache.set(cacheKey, {
        data: insights,
        timestamp: Date.now(),
      });

      return insights;
    } catch (_error) {
      this.logger.error'Failed to get learning insights:', _error;
      throw _error;
    }
  }

  /**
   * Update adaptive weights based on user feedback
   */
  private async updateAdaptiveWeights(
    agentName: string,
    feedback: AccessPattern['userFeedback']
  ): Promise<void> {
    try {
      // Get recent feedback for this agent
      const { data: recentFeedback } = await this.supabase
        .from('memory_access_patterns')
        .select('user_feedback, similarity_score, response_useful')
        .eq('agent_name', agentName)
        .not('user_feedback', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!recentFeedback || recentFeedback.length < 10) return;

      // Analyze correlations between scores and user satisfaction
      let similarityCorrelation = 0;
      let responseUsefulCorrelation = 0;
      let totalSamples = 0;

      recentFeedback.forEach((item) => {
        if (item.user_feedback) {
          const satisfaction = (item.user_feedback.relevance + item.user_feedback.helpfulness) / 2;

          if (item.similarity_score) {
            similarityCorrelation += (item.similarity_score - 0.5) * (satisfaction - 3);
          }

          if (item.response_useful !== null) {
            responseUsefulCorrelation += (item.response_useful ? 1 : 0) * (satisfaction - 3);
          }

          totalSamples++;
        }
      });

      // Adjust weights based on correlations
      if (totalSamples > 0) {
        similarityCorrelation /= totalSamples;
        responseUsefulCorrelation /= totalSamples;

        // Gradually adjust weights (learning rate = 0.1)
        const learningRate = 0.1;

        if (similarityCorrelation > 0.1) {
          this.adaptiveWeights.similarityWeight += learningRate * 0.05;
          this.adaptiveWeights.frequencyWeight -= learningRate * 0.025;
        } else if (similarityCorrelation < -0.1) {
          this.adaptiveWeights.similarityWeight -= learningRate * 0.05;
          this.adaptiveWeights.frequencyWeight += learningRate * 0.025;
        }

        // Normalize weights to sum to 1
        const totalWeight = Object.values(this.adaptiveWeights).reduce(
          (sum, weight) => sum + weight,
          0
        );
        Object.keys(this.adaptiveWeights).forEach((key) => {
          this.adaptiveWeights[key as keyof typeof this.adaptiveWeights] /= totalWeight;
        });

        this.logger.debug(`Updated adaptive weights for ${agentName}:`, this.adaptiveWeights);
      }
    } catch (_error) {
      this.logger.error'Failed to update adaptive weights:', _error;
    }
  }

  /**
   * Generate comprehensive learning insights
   */
  private async generateLearningInsights(agentName: string): Promise<LearningInsights> {
    try {
      // Get access patterns for the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const { data: accessPatterns } = await this.supabase
        .from('memory_access_patterns')
        .select(
          `
          *,
          ai_memories!memory_access_patterns_memory_id_fkey (
            service_id,
            memory_type,
            importance_score
          )
        `
        )
        .eq('agent_name', agentName)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (!accessPatterns || accessPatterns.length === 0) {
        return this.getDefaultInsights();
      }

      // Analyze user preferences
      const memoryTypes = new Map<string, { count: number; avgSatisfaction: number }>();
      const agents = new Map<string, { count: number; avgSatisfaction: number }>();
      const hourlyActivity = new Array(24).fill(0);
      const commonQueries = new Map<string, number>();

      let totalSessionLength = 0;
      let sessionCount = 0;

      accessPatterns.forEach((_pattern => {
        // Memory type preferences
        const memoryType = _patternai_memories?.memory_type || 'unknown';
        const satisfaction = _patternuser_feedback
          ? (_patternuser_feedback.relevance + _patternuser_feedback.helpfulness) / 2
          : 3;

        const typeData = memoryTypes.get(memoryType) || { count: 0, avgSatisfaction: 0 };
        typeData.count++;
        typeData.avgSatisfaction =
          (typeData.avgSatisfaction * (typeData.count - 1) + satisfaction) / typeData.count;
        memoryTypes.set(memoryType, typeData);

        // Agent preferences
        const agentId = _patternai_memories?.service_id || agentName;
        const agentData = agents.get(agentId) || { count: 0, avgSatisfaction: 0 };
        agentData.count++;
        agentData.avgSatisfaction =
          (agentData.avgSatisfaction * (agentData.count - 1) + satisfaction) / agentData.count;
        agents.set(agentId, agentData);

        // Time patterns
        const hour = new Date(_patterncreated_at).getHours();
        hourlyActivity[hour]++;

        // Session length
        if (_patterncontextual_factors?.sessionLength) {
          totalSessionLength += _patterncontextual_factors.sessionLength;
          sessionCount++;
        }

        // Follow-up queries
        if (_patternfollow_up_queries) {
          _patternfollow_up_queries.forEach((query: string) => {
            commonQueries.set(query, (commonQueries.get(query) || 0) + 1);
          });
        }
      });

      // Generate recommendations
      const recommendations: string[] = [];

      const avgSatisfaction =
        accessPatterns
          .filter((p) => p.user_feedback)
          .reduce(
            (sum, p) => sum + (p.user_feedback.relevance + p.user_feedback.helpfulness) / 2,
            0
          ) / accessPatterns.filter((p) => p.user_feedback).length;

      if (avgSatisfaction < 3) {
        recommendations.push(
          'Consider improving memory relevance - user satisfaction is below average'
        );
      }

      const successRate =
        accessPatterns.filter((p) => p.response_useful).length / accessPatterns.length;
      if (successRate < 0.7) {
        recommendations.push('Focus on memory quality - response usefulness could be improved');
      }

      if (recommendations.length === 0) {
        recommendations.push('Learning patterns look good - continue current approach');
      }

      return {
        userPreferences: {
          preferredMemoryTypes: Array.from(memoryTypes.entries())
            .map(([type, data]) => ({ type, weight: data.avgSatisfaction * data.count }))
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 5),
          preferredAgents: Array.from(agents.entries())
            .map(([agent, data]) => ({ agent, weight: data.avgSatisfaction * data.count }))
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 5),
          timeOfDayPatterns: hourlyActivity
            .map((activity, hour) => ({ hour, activity }))
            .filter((item) => item.activity > 0),
          averageSessionLength: sessionCount > 0 ? totalSessionLength / sessionCount : 0,
        },
        searchPatterns: {
          commonQueries: Array.from(commonQueries.entries())
            .map(([query, frequency]) => ({ query, frequency }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 10),
          failurePatterns: [], // Would need more sophisticated analysis
          successFactors: [
            { factor: 'High similarity score', impact: this.adaptiveWeights.similarityWeight },
            { factor: 'Recent access', impact: this.adaptiveWeights.recencyWeight },
            { factor: 'Frequent use', impact: this.adaptiveWeights.frequencyWeight },
          ],
        },
        adaptiveWeights: { ...this.adaptiveWeights },
        recommendations,
      };
    } catch (_error) {
      this.logger.error'Failed to generate learning insights:', _error;
      return this.getDefaultInsights();
    }
  }

  private async updateMemoryStats(memoryId: string, responseUseful?: boolean): Promise<void> {
    try {
      const updateData: any = {
        last_accessed: new Date().toISOString(),
      };

      // Increment access count
      const { data: currentMemory } = await this.supabase
        .from('ai_memories')
        .select('access_count, importance_score')
        .eq('id', memoryId)
        .single();

      if (currentMemory) {
        updateData.access_count = (currentMemory.access_count || 0) + 1;

        // Adjust importance based on usefulness
        if (responseUseful === true) {
          updateData.importance_score = Math.min(1.0, currentMemory.importance_score + 0.01);
        } else if (responseUseful === false) {
          updateData.importance_score = Math.max(0.0, currentMemory.importance_score - 0.005);
        }
      }

      await this.supabase.from('ai_memories').update(updateData).eq('id', memoryId);
    } catch (_error) {
      this.logger.warn('Failed to update memory stats:', _error;
    }
  }

  private getDefaultInsights(): LearningInsights {
    return {
      userPreferences: {
        preferredMemoryTypes: [],
        preferredAgents: [],
        timeOfDayPatterns: [],
        averageSessionLength: 0,
      },
      searchPatterns: {
        commonQueries: [],
        failurePatterns: [],
        successFactors: [],
      },
      adaptiveWeights: { ...this.adaptiveWeights },
      recommendations: ['Collect more usage data to generate personalized insights'],
    };
  }

  /**
   * Clear learning cache
   */
  clearCache(): void {
    this.learningCache.clear();
  }

  /**
   * Get current adaptive weights
   */
  getAdaptiveWeights(): typeof this.adaptiveWeights {
    return { ...this.adaptiveWeights };
  }
}

// Singleton instance
let globalAccessLearner: AccessPatternLearner | null = null;

export function getAccessPatternLearner(
  supabase: SupabaseClient,
  logger: Logger
): AccessPatternLearner {
  if (!globalAccessLearner) {
    globalAccessLearner = new AccessPatternLearner(supabase, logger);
  }
  return globalAccessLearner;
}

export function resetAccessPatternLearner(): void {
  globalAccessLearner = null;
}

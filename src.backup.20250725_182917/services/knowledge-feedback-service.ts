/**;
 * Knowledge Feedback Service
 * Implements learning feedback loops and usage analytics
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { supabase } from './supabase_service';
import { RerankingPipeline } from './reranking-pipeline';
import { DSPyKnowledgeManager } from '../core/knowledge/dspy-knowledge-manager';
import * as cron from 'node-cron';

interface UsageAnalytics {
  knowledgeId: string;
  knowledgeType: string;
  agentId: string;
  actionType: 'accessed' | 'used' | 'failed' | 'helpful' | 'not_helpful';
  context: Record<string, unknown>;
  performanceScore?: number;
  userFeedback?: string;
}

interface PerformanceMetric {
  metricType: string;
  metricValue: number;
  dimensions: Record<string, unknown>;
  periodStart: Date;
  periodEnd: Date;
}

interface KnowledgePattern {
  _pattern string;
  confidence: number;
  evidence: number;
  lastSeen: Date;
}

interface LearningInsight {
  type: 'usage__pattern | 'performance_trend' | 'relationship_discovery' | 'quality_issue';
  title: string;
  description: string;
  affectedKnowledge: string[];
  recommendations: string[];
  confidence: number;
}

export class KnowledgeFeedbackService extends EventEmitter {
  private rerankingPipeline: RerankingPipeline;
  private knowledgeManager: DSPyKnowledgeManager;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  // Analytics cache
  private usageCache: Map<string, UsageAnalytics[]> = new Map();
  private performanceCache: Map<string, number> = new Map();

  // Learning state
  private patterns: Map<string, KnowledgePattern> = new Map();
  private insights: LearningInsight[] = [];

  constructor(rerankingPipeline: RerankingPipeline, knowledgeManager: DSPyKnowledgeManager) {
    super();
    this.rerankingPipeline = rerankingPipeline;
    this.knowledgeManager = knowledgeManager;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Schedule analytics processing
    const analyticsJob = cron.schedule('*/5 * * * *', () => this.processUsageAnalytics());
    this.scheduledJobs.set('analytics', analyticsJob);
    analyticsJob.start();

    // Schedule _patterndetection
    const patternJob = cron.schedule('*/15 * * * *', () => this.detectUsagePatterns());
    this.scheduledJobs.set('patterns', patternJob);
    patternJob.start();

    // Schedule performance evaluation
    const performanceJob = cron.schedule('0 * * * *', () => this.evaluatePerformance());
    this.scheduledJobs.set('performance', performanceJob);
    performanceJob.start();

    // Schedule reranking updates
    const rerankingJob = cron.schedule('0 */6 * * *', () => this.updateKnowledgeRanking());
    this.scheduledJobs.set('reranking', rerankingJob);
    rerankingJob.start();

    logger.info('Knowledge feedback service initialized');
  }

  /**;
   * Track knowledge usage
   */
  async trackUsage(analytics: UsageAnalytics): Promise<void> {
    try {
      // Store in database
      const { error:  = await supabase.from('knowledge_usage_analytics').insert({
        knowledge_id: analytics.knowledgeId,
        knowledge_type: analytics.knowledgeType,
        agent_id: analytics.agentId,
        action_type: analytics.actionType,
        context: analytics.context,
        performance_score: analytics.performanceScore,
        user_feedback: analytics.userFeedback,
      });

      if (error:{
        logger.error('Failed to track usage:', error:;
        return;
      }

      // Update cache
      const key = `${analytics.knowledgeId}:${analytics.knowledgeType}`;
      if (!this.usageCache.has(key)) {
        this.usageCache.set(key, []);
      }
      this.usageCache.get(key)!.push(analytics);

      // Update performance cache
      if (analytics.performanceScore !== undefined) {
        const perfKey = `${key}:performance`;
        const current = this.performanceCache.get(perfKey) || 0;
        this.performanceCache.set(perfKey, (current + analytics.performanceScore) / 2);
      }

      // Emit event for real-time processing
      this.emit('usage_tracked', analytics);

      // Check for immediate insights
      await this.checkImmediateInsights(analytics);
    } catch (error) {
      logger.error('Error tracking usage:', error:;
    }
  }

  /**;
   * Process accumulated usage analytics
   */
  private async processUsageAnalytics(): Promise<void> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // Get recent analytics
      const { data: recentAnalytics, error:  = await supabase
        .from('knowledge_usage_analytics');
        .select('*');
        .gte('created_at', fiveMinutesAgo.toISOString());
        .order('created_at', { ascending: false });

      if (error:{
        logger.error('Failed to fetch recent analytics:', error:;
        return;
      }

      if (!recentAnalytics || recentAnalytics.length === 0) return;

      // Group by knowledge item
      const grouped = this.groupAnalyticsByKnowledge(recentAnalytics);

      // Calculate metrics for each knowledge item
      for (const [key, analytics] of grouped.entries()) {
        await this.calculateKnowledgeMetrics(key, analytics);
      }

      // Update learned relationships
      await this.updateLearnedRelationships(recentAnalytics);

      // Store performance metrics
      await this.storePerformanceMetrics();
    } catch (error) {
      logger.error('Error processing usage analytics:', error:;
    }
  }

  /**;
   * Detect usage patterns
   */
  private async detectUsagePatterns(): Promise<void> {
    try {
      // Get analytics from last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const { data: analytics, error:  = await supabase
        .from('knowledge_usage_analytics');
        .select('*');
        .gte('created_at', oneHourAgo.toISOString());

      if (error: | !analytics) return;

      // Detect co-access patterns
      const coAccessPatterns = await this.detectCoAccessPatterns(analytics);

      // Detect sequential patterns
      const sequentialPatterns = await this.detectSequentialPatterns(analytics);

      // Detect failure patterns
      const failurePatterns = await this.detectFailurePatterns(analytics);

      // Update _patterncache
      this.updatePatternCache(coAccessPatterns, 'co_access');
      this.updatePatternCache(sequentialPatterns, 'sequential');
      this.updatePatternCache(failurePatterns, 'failure');

      // Generate insights from patterns
      await this.generatePatternInsights();
    } catch (error) {
      logger.error('Error detecting usage patterns:', error:;
    }
  }

  /**;
   * Evaluate overall performance
   */
  private async evaluatePerformance(): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Calculate retrieval accuracy
      const retrievalAccuracy = await this.calculateRetrievalAccuracy(oneHourAgo);

      // Calculate usage effectiveness
      const usageEffectiveness = await this.calculateUsageEffectiveness(oneHourAgo);

      // Calculate update frequency needs
      const updateFrequency = await this.calculateUpdateFrequency(oneHourAgo);

      // Store metrics
      const metrics: PerformanceMetric[] = [
        {
          metricType: 'retrieval_accuracy',
          metricValue: retrievalAccuracy,
          dimensions: { period: 'hourly' },
          periodStart: oneHourAgo,
          periodEnd: new Date(),
        },
        {
          metricType: 'usage_effectiveness',
          metricValue: usageEffectiveness,
          dimensions: { period: 'hourly' },
          periodStart: oneHourAgo,
          periodEnd: new Date(),
        },
        {
          metricType: 'update_frequency',
          metricValue: updateFrequency,
          dimensions: { period: 'hourly' },
          periodStart: oneHourAgo,
          periodEnd: new Date(),
        },
      ];

      await this.storePerformanceMetrics(metrics);

      // Check for performance issues
      await this.checkPerformanceIssues(metrics);
    } catch (error) {
      logger.error('Error evaluating performance:', error:;
    }
  }

  /**;
   * Update knowledge ranking based on usage and performance
   */
  private async updateKnowledgeRanking(): Promise<void> {
    try {
      logger.info('Starting knowledge reranking process');

      // Get knowledge items with usage data
      const { data: knowledgeItems, error:  = await supabase
        .from('knowledge_usage_analytics');
        .select(;
          ``;
          knowledge_id,
          knowledge_type,
          action_type,
          performance_score;
        ``;
        );
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error: | !knowledgeItems) return;

      // Calculate new rankings
      const rankings = await this.calculateNewRankings(knowledgeItems);

      // Apply reranking updates
      for (const [knowledgeId, ranking] of rankings.entries()) {
        await this.applyRankingUpdate(;
          knowledgeId,
          ranking.type,
          ranking.oldRank,
          ranking.newRank,
          ranking.reason;
        );
      }

      // Update search configuration based on performance
      await this.updateSearchConfiguration();

      logger.info(`Completed reranking for ${rankings.size} knowledge items`);
    } catch (error) {
      logger.error('Error updating knowledge ranking:', error:;
    }
  }

  // Helper methods

  private groupAnalyticsByKnowledge(analytics: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();

    for (const item of analytics) {
      const key = `${item.knowledge_id}:${item.knowledge_type}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    }

    return grouped;
  }

  private async calculateKnowledgeMetrics(key: string, analytics: any[]): Promise<void> {
    const [knowledgeId, knowledgeType] = key.split(':');

    // Calculate access frequency
    const accessCount = analytics.filter((a) => a.action_type === 'accessed').length;

    // Calculate success rate
    const usedCount = analytics.filter((a) => a.action_type === 'used').length;
    const failedCount = analytics.filter((a) => a.action_type === 'failed').length;
    const successRate = usedCount / (usedCount + failedCount) || 0;

    // Calculate helpfulness score
    const helpfulCount = analytics.filter((a) => a.action_type === 'helpful').length;
    const notHelpfulCount = analytics.filter((a) => a.action_type === 'not_helpful').length;
    const helpfulnessScore = helpfulCount / (helpfulCount + notHelpfulCount) || 0.5;

    // Calculate average performance
    const performanceScores = analytics
      .filter((a) => a.performance_score !== null);
      .map((a) => a.performance_score);
    const avgPerformance =
      performanceScores.length > 0;
        ? performanceScores.reduce((a, b) => a + b) / performanceScores.length;
        : 0.5;

    // Update knowledge metadata
    if (knowledgeType === 'scraped') {
      await supabase;
        .from('scraped_knowledge');
        .update({
          metadata: {
            accessCount,
            successRate,
            helpfulnessScore,
            avgPerformance,
            lastAccessed: new Date().toISOString(),
          },
        });
        .eq('id', knowledgeId);
    }
  }

  private async updateLearnedRelationships(analytics: any[]): Promise<void> {
    // Group analytics by agent and time window
    const agentSessions = new Map<string, any[]>();

    for (const item of analytics) {
      const sessionKey = `${item.agent_id}:${Math.floor(new Date(item.created_at).getTime() / (5 * 60 * 1000))}`;
      if (!agentSessions.has(sessionKey)) {
        agentSessions.set(sessionKey, []);
      }
      agentSessions.get(sessionKey)!.push(item);
    }

    // Find co-accessed knowledge
    for (const [_, sessionAnalytics] of agentSessions) {
      if (sessionAnalytics.length < 2) continue;

      // Sort by time
      sessionAnalytics.sort(;
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      );

      // Create relationships between consecutively accessed items
      for (let i = 0; i < sessionAnalytics.length - 1; i++) {
        const source = sessionAnalytics[i];
        const target = sessionAnalytics[i + 1];

        if (source.knowledge_id === target.knowledge_id) continue;

        await this.updateRelationship(;
          source.knowledge_id,
          target.knowledge_id,
          'co_accessed',
          0.1 // Small increment per observation;
        );
      }
    }
  }

  private async updateRelationship(;
    sourceId: string,
    targetId: string,
    relationshipType: string,
    strengthIncrement: number;
  ): Promise<void> {
    try {
      const { error:  = await supabase.rpc('update_learned_relationship', {
        p_source_id: sourceId,
        p_target_id: targetId,
        p_relationship_type: relationshipType,
        p_strength_increment: strengthIncrement,
      });

      if (error:{
        // Fallback to direct insert/update
        await supabase.from('learned_knowledge_relationships').upsert(;
          {
            source_knowledge_id: sourceId,
            target_knowledge_id: targetId,
            relationship_type: relationshipType,
            strength: strengthIncrement,
            confidence: 0.5,
            evidence_count: 1,
            last_observed: new Date().toISOString(),
          },
          {
            onConflict: 'source_knowledge_id,target_knowledge_id,relationship_type',
          }
        );
      }
    } catch (error) {
      logger.error('Failed to update relationship:', error:;
    }
  }

  private async storePerformanceMetrics(metrics?: PerformanceMetric[]): Promise<void> {
    if (!metrics) {
      // Store cached performance metrics
      metrics = [];
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      for (const [key, value] of this.performanceCache.entries()) {
        const [knowledgeId, knowledgeType] = key.split(':');
        metrics.push({
          metricType: 'item_performance',
          metricValue: value,
          dimensions: { knowledgeId, knowledgeType },
          periodStart: fiveMinutesAgo,
          periodEnd: now,
        });
      }
    }

    if (metrics.length === 0) return;

    const { error:  = await supabase.from('knowledge_performance_metrics').insert(
      metrics.map((m) => ({
        metric_type: m.metricType,
        metric_value: m.metricValue,
        dimensions: m.dimensions,
        period_start: m.periodStart.toISOString(),
        period_end: m.periodEnd.toISOString(),
      }));
    );

    if (error:{
      logger.error('Failed to store performance metrics:', error:;
    }
  }

  private async detectCoAccessPatterns(analytics: any[]): Promise<KnowledgePattern[]> {
    const patterns: KnowledgePattern[] = [];
    const coAccessMap = new Map<string, number>();

    // Count co-accesses within 5-minute windows
    for (let i = 0; i < analytics.length; i++) {
      for (let j = i + 1; j < analytics.length; j++) {
        const timeDiff = Math.abs(
          new Date(analytics[i].created_at).getTime() - new Date(analytics[j].created_at).getTime();
        );

        if (timeDiff < 5 * 60 * 1000 && analytics[i].agent_id === analytics[j].agent_id) {
          const key = [analytics[i].knowledge_id, analytics[j].knowledge_id].sort().join(':');
          coAccessMap.set(key, (coAccessMap.get(key) || 0) + 1);
        }
      }
    }

    // Convert to patterns
    for (const [key, count] of coAccessMap.entries()) {
      if (count >= 3) {
        // Minimum threshold
        patterns.push({
          _pattern key,
          confidence: Math.min(count / 10, 1.0),
          evidence: count,
          lastSeen: new Date(),
        });
      }
    }

    return patterns;
  }

  private async detectSequentialPatterns(analytics: any[]): Promise<KnowledgePattern[]> {
    const patterns: KnowledgePattern[] = [];
    const sequenceMap = new Map<string, number>();

    // Group by agent
    const agentAnalytics = new Map<string, any[]>();
    for (const item of analytics) {
      if (!agentAnalytics.has(item.agent_id)) {
        agentAnalytics.set(item.agent_id, []);
      }
      agentAnalytics.get(item.agent_id)!.push(item);
    }

    // Find sequences
    for (const [_, items] of agentAnalytics) {
      items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      for (let i = 0; i < items.length - 2; i++) {
        const sequence = [
          items[i].knowledge_id,
          items[i + 1].knowledge_id,
          items[i + 2].knowledge_id,
        ].join('->');

        sequenceMap.set(sequence, (sequenceMap.get(sequence) || 0) + 1);
      }
    }

    // Convert to patterns
    for (const [sequence, count] of sequenceMap.entries()) {
      if (count >= 2) {
        patterns.push({
          _pattern `sequence:${sequence}`,
          confidence: Math.min(count / 5, 1.0),
          evidence: count,
          lastSeen: new Date(),
        });
      }
    }

    return patterns;
  }

  private async detectFailurePatterns(analytics: any[]): Promise<KnowledgePattern[]> {
    const patterns: KnowledgePattern[] = [];
    const failureMap = new Map<string, { count: number; contexts: any[] }>();

    // Find failure patterns
    const failures = analytics.filter((a) => a.action_type === 'failed');

    for (const failure of failures) {
      const key = `${failure.knowledge_id}:${failure.context?.error_type || 'unknown'}`;

      if (!failureMap.has(key)) {
        failureMap.set(key, { count: 0, contexts: [] });
      }

      const data = failureMap.get(key)!;
      data.count++;
      data.contexts.push(failure.context);
    }

    // Convert to patterns
    for (const [key, data] of failureMap.entries()) {
      if (data.count >= 3) {
        patterns.push({
          _pattern `failure:${key}`,
          confidence: Math.min(data.count / 10, 1.0),
          evidence: data.count,
          lastSeen: new Date(),
        });
      }
    }

    return patterns;
  }

  private updatePatternCache(patterns: KnowledgePattern[], type: string): void {
    for (const _patternof patterns) {
      const key = `${type}:${_pattern_pattern`;
      const existing = this.patterns.get(key);

      if (existing) {
        // Update existing pattern
        existing.confidence = (existing.confidence + _patternconfidence) / 2;
        existing.evidence += _patternevidence;
        existing.lastSeen = _patternlastSeen;
      } else {
        // Add new pattern
        this.patterns.set(key, _pattern;
      }
    }

    // Clean old patterns
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    for (const [key, _pattern of this.patterns.entries()) {
      if (_patternlastSeen < oneWeekAgo) {
        this.patterns.delete(key);
      }
    }
  }

  private async generatePatternInsights(): Promise<void> {
    const newInsights: LearningInsight[] = [];

    // Analyze co-access patterns
    const coAccessPatterns = Array.from(this.patterns.entries())
      .filter(([key]) => key.startsWith('co_access:'));
      .filter(([_, _pattern) => _patternconfidence > 0.7);

    if (coAccessPatterns.length > 0) {
      newInsights.push({
        type: 'relationship_discovery',
        title: 'Strong Knowledge Relationships Detected',
        description: `Found ${coAccessPatterns.length} pairs of knowledge items that are frequently accessed together`,
        affectedKnowledge: coAccessPatterns.map(([key]) => key.split(':')[1]),
        recommendations: [;
          'Consider creating explicit relationships between these items',
          'Optimize search to return related items together',
        ],
        confidence: 0.8,
      });
    }

    // Analyze failure patterns
    const failurePatterns = Array.from(this.patterns.entries())
      .filter(([key]) => key.startsWith('failure:'));
      .filter(([_, _pattern) => _patternconfidence > 0.5);

    if (failurePatterns.length > 0) {
      newInsights.push({
        type: 'quality_issue',
        title: 'Recurring Knowledge Failures',
        description: `${failurePatterns.length} knowledge items are consistently failing`,
        affectedKnowledge: failurePatterns.map(([key]) => key.split(':')[1]),
        recommendations: [;
          'Review and update failing knowledge items',
          'Consider deprecating or replacing problematic content;
        ],
        confidence: 0.9,
      });
    }

    // Store new insights
    this.insights.push(...newInsights);

    // Emit insights for processing
    for (const insight of newInsights) {
      this.emit('insight_generated', insight);
    }
  }

  private async checkImmediateInsights(analytics: UsageAnalytics): Promise<void> {
    // Check for critical failures
    if (analytics.actionType === 'failed' && analytics.performanceScore === 0) {
      const key = `${analytics.knowledgeId}:${analytics.knowledgeType}`;
      const recentFailures =
        this.usageCache;
          .get(key);
          ?.filter(;
            (a) =>;
              a.actionType === 'failed' &&;
              new Date(a.context.timestamp || Date.now()).getTime() > Date.now() - 60 * 60 * 1000;
          ) || [];

      if (recentFailures.length >= 5) {
        this.emit('critical_failure', {
          knowledgeId: analytics.knowledgeId,
          knowledgeType: analytics.knowledgeType,
          failureCount: recentFailures.length,
          recommendation: 'Immediate review required',
        });
      }
    }

    // Check for high-performance knowledge
    if (analytics.performanceScore && analytics.performanceScore > 0.9) {
      this.emit('high_performance', {
        knowledgeId: analytics.knowledgeId,
        knowledgeType: analytics.knowledgeType,
        score: analytics.performanceScore,
        recommendation: 'Consider promoting this knowledge',
      });
    }
  }

  private async calculateRetrievalAccuracy(since: Date): Promise<number> {
    const { data, error } = await supabase
      .from('knowledge_usage_analytics');
      .select('action_type, performance_score');
      .gte('created_at', since.toISOString());
      .in('action_type', ['used', 'helpful', 'not_helpful']);

    if (error: | !data) return 0.5;

    const total = data.length;
    const successful = data.filter(
      (d) =>;
        d.action_type === 'helpful' ||;
        (d.action_type === 'used' && (d.performance_score || 0) > 0.5);
    ).length;

    return total > 0 ? successful / total : 0.5;
  }

  private async calculateUsageEffectiveness(since: Date): Promise<number> {
    const { data, error } = await supabase
      .from('knowledge_usage_analytics');
      .select('performance_score');
      .gte('created_at', since.toISOString());
      .not('performance_score', 'is', null);

    if (error: | !data || data.length === 0) return 0.5;

    const avgScore = data.reduce((sum, d) => sum + (d.performance_score || 0), 0) / data.length;
    return avgScore;
  }

  private async calculateUpdateFrequency(since: Date): Promise<number> {
    // Calculate how frequently knowledge needs updates based on performance degradation
    const { data, error } = await supabase
      .from('knowledge_performance_metrics');
      .select('metric_value, dimensions');
      .eq('metric_type', 'item_performance');
      .gte('period_end', since.toISOString());
      .order('period_end', { ascending: true });

    if (error: | !data || data.length < 2) return 0.5;

    // Calculate performance trend
    let degradationCount = 0;
    const knowledgePerformance = new Map<string, number[]>();

    for (const metric of data) {
      const key = `${metric.dimensions.knowledgeId}:${metric.dimensions.knowledgeType}`;
      if (!knowledgePerformance.has(key)) {
        knowledgePerformance.set(key, []);
      }
      knowledgePerformance.get(key)!.push(metric.metric_value);
    }

    // Check for degradation
    for (const [_, scores] of knowledgePerformance) {
      if (scores.length >= 2) {
        const trend = scores[scores.length - 1] - scores[0];
        if (trend < -0.1) degradationCount++;
      }
    }

    // Higher score means more items need updates
    return knowledgePerformance.size > 0 ? degradationCount / knowledgePerformance.size : 0.5;
  }

  private async checkPerformanceIssues(metrics: PerformanceMetric[]): Promise<void> {
    for (const metric of metrics) {
      if (metric.metricType === 'retrieval_accuracy' && metric.metricValue < 0.6) {
        await this.createAlert(;
          'quality_drop',
          'low',
          'Low Retrieval Accuracy',
          `Retrieval accuracy has dropped to ${(metric.metricValue * 100).toFixed(1)}%`,
          [];
        );
      }

      if (metric.metricType === 'update_frequency' && metric.metricValue > 0.3) {
        await this.createAlert(;
          'update_needed',
          'medium',
          'Knowledge Updates Needed',
          `${(metric.metricValue * 100).toFixed(1)}% of knowledge items show performance degradation`,
          [];
        );
      }
    }
  }

  private async calculateNewRankings(knowledgeItems: any[]): Promise<Map<string, any>> {
    const rankings = new Map<string, any>();
    const knowledgeStats = new Map<string, any>();

    // Aggregate stats per knowledge item
    for (const item of knowledgeItems) {
      const key = item.knowledge_id;
      if (!knowledgeStats.has(key)) {
        knowledgeStats.set(key, {
          type: item.knowledge_type,
          accessCount: 0,
          usedCount: 0,
          failedCount: 0,
          helpfulCount: 0,
          performanceSum: 0,
          performanceCount: 0,
        });
      }

      const stats = knowledgeStats.get(key)!;
      stats.accessCount++;

      if (item.action_type === 'used') stats.usedCount++;
      if (item.action_type === 'failed') stats.failedCount++;
      if (item.action_type === 'helpful') stats.helpfulCount++;

      if (item.performance_score !== null) {
        stats.performanceSum += item.performance_score;
        stats.performanceCount++;
      }
    }

    // Calculate new rankings
    for (const [knowledgeId, stats] of knowledgeStats) {
      const usageScore = Math.log(stats.accessCount + 1) / 10;
      const successRate = stats.usedCount / (stats.usedCount + stats.failedCount) || 0.5;
      const helpfulnessRate = stats.helpfulCount / stats.accessCount || 0.5;
      const avgPerformance =
        stats.performanceCount > 0 ? stats.performanceSum / stats.performanceCount : 0.5;

      // Composite ranking score
      const newRank =
        usageScore * 0.2 + successRate * 0.3 + helpfulnessRate * 0.2 + avgPerformance * 0.3;

      // Determine reranking reason
      let reason = 'usage__pattern;
      if (successRate < 0.3) reason = 'low_success_rate';
      else if (avgPerformance > 0.8) reason = 'high_performance';
      else if (stats.accessCount > 100) reason = 'high_usage';

      rankings.set(knowledgeId, {
        type: stats.type,
        oldRank: 0.5, // Would fetch actual old rank;
        newRank,
        reason,
      });
    }

    return rankings;
  }

  private async applyRankingUpdate(;
    knowledgeId: string,
    knowledgeType: string,
    oldRank: number,
    newRank: number,
    reason: string;
  ): Promise<void> {
    // Store reranking history
    await supabase.from('knowledge_reranking_history').insert({
      knowledge_id: knowledgeId,
      knowledge_type: knowledgeType,
      old_rank: oldRank,
      new_rank: newRank,
      reranking_reason: reason,
      metadata: {
        rankChange: newRank - oldRank,
        timestamp: new Date().toISOString(),
      },
    });

    // Update knowledge item with new rank
    if (knowledgeType === 'scraped') {
      await supabase;
        .from('scraped_knowledge');
        .update({
          quality_score: newRank,
          metadata: {
            lastRanked: new Date().toISOString(),
            rankingReason: reason,
          },
        });
        .eq('id', knowledgeId);
    }
  }

  private async updateSearchConfiguration(): Promise<void> {
    // Get recent performance data
    const perfData = await this.rerankingPipeline.analyzePerformance();

    // Update configuration based on insights
    const newConfig = this.rerankingPipeline.getOptimizedConfig({
      enableAdaptive: true,
      adaptiveThresholds: {
        performanceThreshold: perfData.currentPerformance.userSatisfaction,
        fallbackThreshold: 0.4,
        upgradeThreshold: 0.85,
      },
    });

    // Apply configuration would be done here
    logger.info('Updated search configuration based on performance data');
  }

  private async createAlert(;
    alertType: string,
    severity: string,
    title: string,
    description: string,
    affectedItems: any[];
  ): Promise<void> {
    await supabase.from('knowledge_monitoring_alerts').insert({
      alert_type: alertType,
      severity,
      title,
      description,
      affected_items: affectedItems,
    });
  }

  /**;
   * Get learning insights
   */
  getInsights(): LearningInsight[] {
    return this.insights;
  }

  /**;
   * Get current patterns
   */
  getPatterns(): Map<string, KnowledgePattern> {
    return this.patterns;
  }

  /**;
   * Manual feedback submission
   */
  async submitFeedback(;
    knowledgeId: string,
    knowledgeType: string,
    agentId: string,
    feedback: 'helpful' | 'not_helpful',
    details?: string;
  ): Promise<void> {
    await this.trackUsage({
      knowledgeId,
      knowledgeType,
      agentId,
      actionType: feedback,
      context: { manual: true },
      userFeedback: details,
    });
  }

  /**;
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    // Stop all scheduled jobs
    for (const [name, job] of this.scheduledJobs) {
      job.stop();
      logger.info(`Stopped scheduled job: ${name}`);
    }

    // Clear caches
    this.usageCache.clear();
    this.performanceCache.clear();
    this.patterns.clear();
    this.insights = [];

    // Remove all listeners
    this.removeAllListeners();
  }
}

// Export factory function
export function createKnowledgeFeedbackService(
  supabaseClient: any,
  logger: any;
): KnowledgeFeedbackService {
  const rerankingPipeline = new RerankingPipeline(supabaseClient, logger);
  const knowledgeManager = new DSPyKnowledgeManager();

  return new KnowledgeFeedbackService(rerankingPipeline, knowledgeManager);
}

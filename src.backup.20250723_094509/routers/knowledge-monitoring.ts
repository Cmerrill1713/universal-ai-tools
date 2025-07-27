/**
 * Knowledge Monitoring Router
 * API endpoints for knowledge base health monitoring and management
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { KNOWLEDGE_SOURCES } from '../config/knowledge-sources';
import { DSPyKnowledgeManager } from '../core/knowledge/dspy-knowledge-manager';
import { createKnowledgeFeedbackService } from '../services/knowledge-feedback-service';
import { knowledgeScraperService } from '../services/knowledge-scraper-service';
import { createKnowledgeUpdateAutomation } from '../services/knowledge-update-automation';
import { knowledgeValidationService } from '../services/knowledge-validation-service';
import { logger } from '../utils/logger';

export default function createKnowledgeMonitoringRouter(supabase: SupabaseClient) {
  const router = Router();

  // Initialize services
  const knowledgeManager = new DSPyKnowledgeManager();
  const feedbackService = createKnowledgeFeedbackService(supabase, logger);
  const updateAutomation = createKnowledgeUpdateAutomation(
    knowledgeScraperService,
    knowledgeValidationService,
    feedbackService,
    knowledgeManager
  );

  // Authentication is applied at the app level

  /**
   * GET /api/knowledge-monitoring/dashboard
   * Get comprehensive dashboard data
   */
  router.get('/dashboard', async (req: Request, res: Response) => {
    try {
      const timeRange = (req.query.timeRange as string) || '24h';
      const since = getTimeSince(timeRange);

      // Fetch all dashboard data in parallel
      const [
        overview,
        sourceHealth,
        validationMetrics,
        usageAnalytics,
        performanceMetrics,
        activeAlerts,
        updateQueue,
        insights,
      ] = await Promise.all([
        getOverviewMetrics(since),
        getSourceHealthMetrics(),
        getValidationMetrics(since),
        getUsageAnalytics(since),
        getPerformanceMetrics(since),
        getActiveAlerts(),
        getUpdateQueueStatus(),
        feedbackService.getInsights(),
      ]);

      res.json({
        timestamp: new Date().toISOString(),
        timeRange,
        overview,
        sourceHealth,
        validationMetrics,
        usageAnalytics,
        performanceMetrics,
        activeAlerts,
        updateQueue,
        insights: insights.slice(0, 10), // Limit to recent insights
      });
    } catch (error) {
      logger.error('Error fetching dashboard data:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });

  /**
   * GET /api/knowledge-monitoring/sources
   * Get detailed source status
   */
  router.get('/sources', async (_req, res) => {
    try {
      const sources = await Promise.all(
        KNOWLEDGE_SOURCES.map(async (source) => {
          const [lastScrape, itemCount, qualityScore, issues] = await Promise.all([
            getLastScrapeTime(source.id),
            getSourceItemCount(source.id),
            getSourceQualityScore(source.id),
            getSourceIssues(source.id),
          ]);

          return {
            id: source.id,
            name: source.name,
            type: source.type,
            url: source.url,
            enabled: source.enabled,
            priority: source.priority,
            credibilityScore: source.credibilityScore,
            updateFrequency: source.updateFrequency,
            lastScrape,
            itemCount,
            averageQualityScore: qualityScore,
            activeIssues: issues.length,
            status: determineSourceStatus(lastScrape, issues.length, source.enabled),
          };
        })
      );

      res.json({ sources });
    } catch (error) {
      logger.error('Error fetching source status:', error);
      res.status(500).json({ error: 'Failed to fetch source status' });
    }
  });

  /**
   * GET /api/knowledge-monitoring/alerts
   * Get monitoring alerts with filtering
   */
  router.get('/alerts', async (req, res) => {
    try {
      const { status, severity, type, limit = 50 } = req.query;

      let query = supabase
        .from('knowledge_monitoring_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      if (status) query = query.eq('status', status);
      if (severity) query = query.eq('severity', severity);
      if (type) query = query.eq('alert_type', type);

      const { data: alerts, error } = await query;

      if (error) throw error;

      res.json({
        alerts,
        summary: {
          total: alerts?.length || 0,
          bySeverity: groupBy(alerts || [], 'severity'),
          byType: groupBy(alerts || [], 'alert_type'),
          byStatus: groupBy(alerts || [], 'status'),
        },
      });
    } catch (error) {
      logger.error('Error fetching alerts:', error);
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  });

  /**
   * PUT /api/knowledge-monitoring/alerts/:id
   * Update alert status
   */
  router.put('/alerts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { status, resolution_notes } = req.body;

      const updates: any = { status };

      if (status === 'acknowledged') {
        updates.acknowledged_at = new Date().toISOString();
      } else if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
        updates.resolution_notes = resolution_notes;
      }

      const { data, error } = await supabase
        .from('knowledge_monitoring_alerts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.json({ alert: data });
    } catch (error) {
      logger.error('Error updating alert:', error);
      res.status(500).json({ error: 'Failed to update alert' });
    }
  });

  /**
   * GET /api/knowledge-monitoring/performance
   * Get detailed performance metrics
   */
  router.get('/performance', async (req, res) => {
    try {
      const { metricType, period = '24h', groupBy = 'hour' } = req.query;
      const since = getTimeSince(period as string);

      const { data: metrics, error } = await supabase
        .from('knowledge_performance_metrics')
        .select('*')
        .gte('period_start', since.toISOString())
        .order('period_start', { ascending: true });

      if (error) throw error;

      // Filter by metric type if specified
      const filteredMetrics = metricType
        ? metrics?.filter((m) => m.metric_type === metricType)
        : metrics;

      // Group by time period
      const grouped = groupMetricsByPeriod(filteredMetrics || [], groupBy as string);

      res.json({
        metrics: grouped,
        summary: {
          averageValue: calculateAverage(filteredMetrics || [], 'metric_value'),
          trend: calculateTrend(filteredMetrics || []),
          periodStart: since.toISOString(),
          periodEnd: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error fetching performance metrics:', error);
      res.status(500).json({ error: 'Failed to fetch performance metrics' });
    }
  });

  /**
   * GET /api/knowledge-monitoring/usage-patterns
   * Get knowledge usage patterns
   */
  router.get('/usage-patterns', async (_req, res) => {
    try {
      const patterns = feedbackService.getPatterns();

      // Convert Map to array for JSON serialization
      const patternArray = Array.from(patterns.entries()).map(([key, _pattern) => ({
        id: key,
        ..._pattern
      }));

      // Sort by confidence and evidence
      patternArray.sort((a, b) => {
        const scoreA = a.confidence * Math.log(a.evidence + 1);
        const scoreB = b.confidence * Math.log(b.evidence + 1);
        return scoreB - scoreA;
      });

      res.json({
        patterns: patternArray.slice(0, 50), // Top 50 patterns
        summary: {
          total: patternArray.length,
          highConfidence: patternArray.filter((p) => p.confidence > 0.8).length,
          recentlyActive: patternArray.filter(
            (p) => new Date(p.lastSeen).getTime() > Date.now() - 24 * 60 * 60 * 1000
          ).length,
        },
      });
    } catch (error) {
      logger.error('Error fetching usage patterns:', error);
      res.status(500).json({ error: 'Failed to fetch usage patterns' });
    }
  });

  /**
   * GET /api/knowledge-monitoring/update-status
   * Get knowledge update automation status
   */
  router.get('/update-status', async (_req, res) => {
    try {
      const [statistics, queue, recentJobs] = await Promise.all([
        updateAutomation.getStatistics(),
        getUpdateQueueDetails(),
        getRecentUpdateJobs(),
      ]);

      res.json({
        statistics,
        queue,
        recentJobs,
        health: {
          isHealthy: statistics.recentFailures < statistics.recentCompletions * 0.1,
          successRate:
            statistics.recentCompletions /
              (statistics.recentCompletions + statistics.recentFailures) || 0,
        },
      });
    } catch (error) {
      logger.error('Error fetching update status:', error);
      res.status(500).json({ error: 'Failed to fetch update status' });
    }
  });

  /**
   * POST /api/knowledge-monitoring/manual-update
   * Trigger manual knowledge update
   */
  router.post('/manual-update', async (req, res) => {
    try {
      const { sourceId, url, updateType = 'update', priority = 8 } = req.body;

      if (!sourceId || !url) {
        return res.status(400).json({ error: 'sourceId and url are required' });
      }

      const jobId = await updateAutomation.queueUpdateJob({
        sourceId,
        url,
        updateType,
        priority,
        scheduledFor: new Date(),
      });

      res.json({
        jobId,
        message: 'Update job queued successfully',
        estimatedProcessingTime: '5-10 minutes',
      });
    } catch (error) {
      logger.error('Error queuing manual update:', error);
      res.status(500).json({ error: 'Failed to queue update' });
    }
  });

  /**
   * GET /api/knowledge-monitoring/quality-trends
   * Get knowledge quality trends over time
   */
  router.get('/quality-trends', async (req, res) => {
    try {
      const { period = '7d', sourceId } = req.query;
      const since = getTimeSince(period as string);

      let query = supabase
        .from('scraped_knowledge')
        .select('id, source_id, quality_score, scraped_at, validation_status')
        .gte('scraped_at', since.toISOString())
        .order('scraped_at', { ascending: true });

      if (sourceId) {
        query = query.eq('source_id', sourceId);
      }

      const { data: knowledge, error } = await query.limit(1000);

      if (error) throw error;

      // Calculate daily quality trends
      const dailyTrends = calculateDailyTrends(knowledge || []);

      res.json({
        trends: dailyTrends,
        summary: {
          averageQuality: calculateAverage(knowledge || [], 'quality_score'),
          validatedPercentage: calculatePercentage(
            knowledge || [],
            (item) => item.validation_status === 'validated'
          ),
          totalItems: knowledge?.length || 0,
          period: { start: since.toISOString(), end: new Date().toISOString() },
        },
      });
    } catch (error) {
      logger.error('Error fetching quality trends:', error);
      res.status(500).json({ error: 'Failed to fetch quality trends' });
    }
  });

  /**
   * GET /api/knowledge-monitoring/relationships
   * Get learned knowledge relationships
   */
  router.get('/relationships', async (req, res) => {
    try {
      const { minStrength = 0.5, limit = 100 } = req.query;

      const { data: relationships, error } = await supabase
        .from('learned_knowledge_relationships')
        .select(
          `
        *,
        source:scraped_knowledge!source_knowledge_id(id, title),
        target:scraped_knowledge!target_knowledge_id(id, title)
      `
        )
        .gte('strength', Number(minStrength))
        .order('strength', { ascending: false })
        .limit(Number(limit));

      if (error) throw error;

      // Create graph data
      const nodes = new Set<string>();
      const edges =
        relationships?.map((rel) => {
          nodes.add(rel.source_knowledge_id);
          nodes.add(rel.target_knowledge_id);

          return {
            source: rel.source_knowledge_id,
            target: rel.target_knowledge_id,
            type: rel.relationship_type,
            strength: rel.strength,
            confidence: rel.confidence,
            evidence: rel.evidence_count,
          };
        }) || [];

      res.json({
        graph: {
          nodes: Array.from(nodes).map((id) => ({
            id,
            label:
              relationships?.find(
                (r) => r.source_knowledge_id === id || r.target_knowledge_id === id
              )?.source?.title || id,
          })),
          edges,
        },
        summary: {
          totalRelationships: relationships?.length || 0,
          strongRelationships: relationships?.filter((r) => r.strength > 0.8).length || 0,
          relationshipTypes: groupBy(relationships || [], 'relationship_type'),
        },
      });
    } catch (error) {
      logger.error('Error fetching relationships:', error);
      res.status(500).json({ error: 'Failed to fetch relationships' });
    }
  });

  // Helper functions

  function getTimeSince(timeRange: string): Date {
    const now = new Date();
    const match = timeRange.match(/(\d+)([hdwm])/);

    if (!match) return new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default 24h

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit) {
      case 'h':
        return new Date(now.getTime() - num * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() - num * 24 * 60 * 60 * 1000);
      case 'w':
        return new Date(now.getTime() - num * 7 * 24 * 60 * 60 * 1000);
      case 'm':
        return new Date(now.getTime() - num * 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  async function getOverviewMetrics(since: Date) {
    const [totalKnowledge, activeAlerts, recentUpdates, qualityScore] = await Promise.all([
      supabase.from('scraped_knowledge').select('id', { count: 'exact' }),
      supabase
        .from('knowledge_monitoring_alerts')
        .select('id', { count: 'exact' })
        .eq('status', 'active'),
      supabase
        .from('scraped_knowledge')
        .select('id', { count: 'exact' })
        .gte('scraped_at', since.toISOString()),
      supabase
        .from('scraped_knowledge')
        .select('quality_score')
        .gte('scraped_at', since.toISOString())
        .limit(500),
    ]);

    const avgQuality = calculateAverage(qualityScore.data || [], 'quality_score');

    return {
      totalKnowledgeItems: totalKnowledge.count || 0,
      activeAlerts: activeAlerts.count || 0,
      recentUpdates: recentUpdates.count || 0,
      averageQualityScore: avgQuality,
      healthStatus: determineHealthStatus(activeAlerts.count || 0, avgQuality),
    };
  }

  async function getSourceHealthMetrics() {
    const metrics = await Promise.all(
      KNOWLEDGE_SOURCES.map(async (source) => {
        const { data } = await supabase
          .from('scraped_knowledge')
          .select('quality_score, validation_status')
          .eq('source_id', source.id)
          .gte('scraped_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .limit(200);

        return {
          sourceId: source.id,
          name: source.name,
          itemCount: data?.length || 0,
          averageQuality: calculateAverage(data || [], 'quality_score'),
          validationRate: calculatePercentage(
            data || [],
            (item) => item.validation_status === 'validated'
          ),
        };
      })
    );

    return metrics;
  }

  async function getValidationMetrics(since: Date) {
    const { data: validations } = await supabase
      .from('knowledge_validation')
      .select('validation_type, score')
      .gte('validated_at', since.toISOString())
      .limit(1000);

    const byType = validations?.reduce(
      (acc, val) => {
        if (!acc[val.validation_type]) {
          acc[val.validation_type] = { count: 0, totalScore: 0 };
        }
        acc[val.validation_type].count++;
        acc[val.validation_type].totalScore += val.score;
        return acc;
      },
      {} as Record<string, { count: number; totalScore: number }>
    );

    return Object.entries(byType || {}).map(([type, stats]) => ({
      type,
      count: stats.count,
      averageScore: stats.totalScore / stats.count,
    }));
  }

  async function getUsageAnalytics(since: Date) {
    const { data: usage } = await supabase
      .from('knowledge_usage_analytics')
      .select('action_type, performance_score')
      .gte('created_at', since.toISOString())
      .limit(1000);

    const actionCounts = groupBy(usage || [], 'action_type');
    const performanceByAction = Object.entries(actionCounts).reduce(
      (acc, [action, items]) => {
        acc[action] = {
          count: items.length,
          averagePerformance: calculateAverage(
            items.filter((i: any) => i.performance_score !== null),
            'performance_score'
          ),
        };
        return acc;
      },
      {} as Record<string, { count: number; averagePerformance: number }>
    );

    return performanceByAction;
  }

  async function getPerformanceMetrics(since: Date) {
    const { data: metrics } = await supabase
      .from('knowledge_performance_metrics')
      .select('metric_type, metric_value')
      .gte('period_start', since.toISOString())
      .limit(1000);

    const byType = metrics?.reduce(
      (acc, metric) => {
        if (!acc[metric.metric_type]) {
          acc[metric.metric_type] = [];
        }
        acc[metric.metric_type].push(metric.metric_value);
        return acc;
      },
      {} as Record<string, number[]>
    );

    return Object.entries(byType || {}).map(([type, values]) => ({
      type,
      current: values[values.length - 1] || 0,
      average: values.reduce((a, b) => a + b, 0) / values.length,
      trend: calculateTrend(values.map((v, i) => ({ metric_value: v, index: i }))),
    }));
  }

  async function getActiveAlerts() {
    const { data: alerts } = await supabase
      .from('knowledge_monitoring_alerts')
      .select('*')
      .eq('status', 'active')
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10);

    return alerts || [];
  }

  async function getUpdateQueueStatus() {
    const { data: queue } = await supabase
      .from('knowledge_update_queue')
      .select('status, update_type')
      .in('status', ['pending', 'processing'])
      .limit(100);

    const byStatus = groupBy(queue || [], 'status');
    const byType = groupBy(queue || [], 'update_type');

    return {
      pending: byStatus.pending?.length || 0,
      processing: byStatus.processing?.length || 0,
      byType: Object.entries(byType).map(([type, items]) => ({
        type,
        count: items.length,
      })),
    };
  }

  async function getLastScrapeTime(sourceId: string): Promise<Date | null> {
    const { data } = await supabase
      .from('scraped_knowledge')
      .select('scraped_at')
      .eq('source_id', sourceId)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();

    return data ? new Date(data.scraped_at) : null;
  }

  async function getSourceItemCount(sourceId: string): Promise<number> {
    const { count } = await supabase
      .from('scraped_knowledge')
      .select('id', { count: 'exact' })
      .eq('source_id', sourceId);

    return count || 0;
  }

  async function getSourceQualityScore(sourceId: string): Promise<number> {
    const { data } = await supabase
      .from('scraped_knowledge')
      .select('quality_score')
      .eq('source_id', sourceId)
      .not('quality_score', 'is', null)
      .limit(100);

    return calculateAverage(data || [], 'quality_score');
  }

  async function getSourceIssues(sourceId: string): Promise<any[]> {
    const { data } = await supabase
      .from('knowledge_monitoring_alerts')
      .select('*')
      .eq('status', 'active')
      .contains('affected_items', [{ source_id: sourceId }]);

    return data || [];
  }

  async function getUpdateQueueDetails() {
    const { data: queue } = await supabase
      .from('knowledge_update_queue')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('priority', { ascending: false })
      .order('scheduled_for', { ascending: true })
      .limit(20);

    return queue || [];
  }

  async function getRecentUpdateJobs() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { data: jobs } = await supabase
      .from('knowledge_update_queue')
      .select('*')
      .gte('updated_at', oneDayAgo.toISOString())
      .order('updated_at', { ascending: false })
      .limit(50);

    return jobs || [];
  }

  // Utility functions

  function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
    return items.reduce(
      (acc, item) => {
        const value = String(item[key]);
        if (!acc[value]) acc[value] = [];
        acc[value].push(item);
        return acc;
      },
      {} as Record<string, T[]>
    );
  }

  function calculateAverage(items: any[], field: string): number {
    if (items.length === 0) return 0;
    const sum = items.reduce((acc, item) => acc + (item[field] || 0), 0);
    return sum / items.length;
  }

  function calculatePercentage(items: any[], predicate: (item: any) => boolean): number {
    if (items.length === 0) return 0;
    const matching = items.filter(predicate).length;
    return (matching / items.length) * 100;
  }

  function calculateTrend(items: any[]): 'improving' | 'stable' | 'declining' {
    if (items.length < 2) return 'stable';

    const firstHalf = items.slice(0, Math.floor(items.length / 2));
    const secondHalf = items.slice(Math.floor(items.length / 2));

    const firstAvg = calculateAverage(firstHalf, 'metric_value');
    const secondAvg = calculateAverage(secondHalf, 'metric_value');

    const change = (secondAvg - firstAvg) / firstAvg;

    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'declining';
    return 'stable';
  }

  function calculateDailyTrends(items: any[]) {
    const dailyData = items.reduce(
      (acc, item) => {
        const date = new Date(item.scraped_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { count: 0, totalQuality: 0, validated: 0 };
        }
        acc[date].count++;
        acc[date].totalQuality += item.quality_score || 0;
        if (item.validation_status === 'validated') acc[date].validated++;
        return acc;
      },
      {} as Record<string, { count: number; totalQuality: number; validated: number }>
    );

    return Object.entries(dailyData)
      .map(([date, data]) => {
        const typedData = data as { count: number; totalQuality: number; validated: number };
        return {
          date,
          itemCount: typedData.count,
          averageQuality: typedData.count > 0 ? typedData.totalQuality / typedData.count : 0,
          validationRate: typedData.count > 0 ? (typedData.validated / typedData.count) * 100 : 0,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function determineSourceStatus(
    lastScrape: Date | null,
    issueCount: number,
    enabled: boolean
  ): 'healthy' | 'warning' | 'error | 'disabled' {
    if (!enabled) return 'disabled';
    if (issueCount > 5) return '_error);
    if (!lastScrape) return 'warning';

    const hoursSinceLastScrape = (Date.now() - lastScrape.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastScrape > 48) return '_error);
    if (hoursSinceLastScrape > 24) return 'warning';

    return 'healthy';
  }

  function determineHealthStatus(alertCount: number, qualityScore: number): string {
    if (alertCount > 10 || qualityScore < 0.5) return 'critical';
    if (alertCount > 5 || qualityScore < 0.7) return 'warning';
    return 'healthy';
  }

  function groupMetricsByPeriod(metrics: any[], _period: string) {
    // Implementation would group metrics by hour/day/week
    // For simplicity, returning as-is
    return metrics;
  }

  return router;
}

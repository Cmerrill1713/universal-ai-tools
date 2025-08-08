/**
 * Context Analytics Service
 *
 * Comprehensive analytics and monitoring for the enhanced context management system.
 * Provides insights into context usage, compression efficiency, retrieval performance,
 * and overall system health.
 *
 * Features:
 * - Real-time context usage metrics
 * - Compression efficiency analytics
 * - Retrieval performance monitoring
 * - User session analytics
 * - Cost optimization insights
 * - System health monitoring
 */

import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { LogContext, log } from '../utils/logger';
import { config } from '../config/environment';
import { contextStorageService } from './context-storage-service';
import { enhancedContextManager } from './enhanced-context-manager';
import { semanticContextRetrievalService } from './semantic-context-retrieval';
import { autoContextMiddleware } from '../middleware/auto-context-middleware';

interface ContextMetrics {
  timestamp: Date;
  totalContexts: number;
  totalMessages: number;
  totalTokens: number;
  compressionRatio: number;
  activeUsers: number;
  activeSessions: number;
  averageContextSize: number;
  retrievalResponseTime: number;
  cacheHitRate: number;
  databaseSize: number; // in MB
}

interface UserAnalytics {
  userId: string;
  sessionCount: number;
  messageCount: number;
  totalTokens: number;
  contextCompressions: number;
  averageSessionDuration: number;
  lastActivity: Date;
  topTopics: string[];
  efficiency: {
    compressionSavings: number;
    retrievalAccuracy: number;
    contextRelevance: number;
  };
}

interface CompressionAnalytics {
  totalCompressions: number;
  averageCompressionRatio: number;
  tokensSaved: number;
  compressionsByType: Record<string, number>;
  compressionTrends: Array<{
    date: Date;
    compressions: number;
    ratio: number;
    tokensSaved: number;
  }>;
}

interface RetrievalAnalytics {
  totalQueries: number;
  averageResponseTime: number;
  averageResults: number;
  averageRelevance: number;
  cacheHitRate: number;
  semanticSearchUsage: number;
  fallbackRate: number;
  topQueryTypes: Record<string, number>;
}

interface SystemHealthMetrics {
  contextManager: {
    status: 'healthy' | 'warning' | 'critical';
    activeContexts: number;
    memoryUsage: number; // MB
    compressionBacklog: number;
  };
  semanticRetrieval: {
    status: 'healthy' | 'warning' | 'critical';
    cacheSize: number;
    embeddingFailures: number;
    averageQueryTime: number;
  };
  database: {
    status: 'healthy' | 'warning' | 'critical';
    totalRecords: number;
    storageSize: number; // MB
    queryPerformance: number; // avg ms
  };
  middleware: {
    status: 'healthy' | 'warning' | 'critical';
    activeSessions: number;
    requestsPerMinute: number;
    errorRate: number;
  };
}

interface CostOptimization {
  potentialSavings: {
    tokenCompressionSavings: number;
    storageOptimization: number;
    cacheEfficiency: number;
  };
  recommendations: Array<{
    type: 'compression' | 'storage' | 'retrieval' | 'caching';
    impact: 'high' | 'medium' | 'low';
    description: string;
    estimatedSavings: number;
  }>;
}

export class ContextAnalyticsService {
  private supabase: SupabaseClient;
  private metricsHistory: ContextMetrics[] = [];
  private readonly MAX_HISTORY_SIZE = 1000;
  private readonly COLLECTION_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private collectionTimer?: NodeJS.Timeout;

  // Performance tracking
  private queryResponseTimes: number[] = [];
  private compressionEvents: Array<{ timestamp: Date; ratio: number; tokensSaved: number }> = [];
  private retrievalEvents: Array<{ timestamp: Date; queryTime: number; resultCount: number }> = [];

  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
    this.startMetricsCollection();

    log.info('📊 Context Analytics Service initialized', LogContext.CONTEXT_INJECTION, {
      collectionInterval: this.COLLECTION_INTERVAL,
      maxHistorySize: this.MAX_HISTORY_SIZE,
    });
  }

  /**
   * Get current system metrics
   */
  async getCurrentMetrics(): Promise<ContextMetrics> {
    try {
      const [
        contextManagerStats,
        middlewareStats,
        semanticCacheStats,
        databaseStats
      ] = await Promise.all([
        this.getContextManagerStats(),
        this.getMiddlewareStats(),
        this.getSemanticCacheStats(),
        this.getDatabaseStats()
      ]);

      const metrics: ContextMetrics = {
        timestamp: new Date(),
        totalContexts: contextManagerStats.activeContexts,
        totalMessages: contextManagerStats.totalMessages,
        totalTokens: contextManagerStats.totalTokens,
        compressionRatio: contextManagerStats.averageCompression,
        activeUsers: this.countUniqueUsers(middlewareStats),
        activeSessions: middlewareStats.activeSessions,
        averageContextSize: contextManagerStats.totalTokens / Math.max(contextManagerStats.activeContexts, 1),
        retrievalResponseTime: this.getAverageResponseTime(),
        cacheHitRate: semanticCacheStats.hitRate,
        databaseSize: databaseStats.totalSize,
      };

      // Add to history
      this.metricsHistory.push(metrics);
      if (this.metricsHistory.length > this.MAX_HISTORY_SIZE) {
        this.metricsHistory.shift();
      }

      return metrics;
    } catch (error) {
      log.error('❌ Failed to collect current metrics', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return fallback metrics
      return {
        timestamp: new Date(),
        totalContexts: 0,
        totalMessages: 0,
        totalTokens: 0,
        compressionRatio: 0,
        activeUsers: 0,
        activeSessions: 0,
        averageContextSize: 0,
        retrievalResponseTime: 0,
        cacheHitRate: 0,
        databaseSize: 0,
      };
    }
  }

  /**
   * Get analytics for a specific user
   */
  async getUserAnalytics(userId: string, timeWindow = 30): Promise<UserAnalytics> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - timeWindow);

      // Get user's context data
      const userContexts = await contextStorageService.getContext(userId, undefined, undefined, 100);

      // Calculate metrics
      const sessionIds = [...new Set(userContexts.map(ctx => ctx.source))];
      const messageCount = userContexts.reduce((sum, ctx) => {
        try {
          const messages = JSON.parse(ctx.content);
          return sum + (Array.isArray(messages) ? messages.length : 1);
        } catch {
          return sum + 1;
        }
      }, 0);

      const totalTokens = userContexts.reduce((sum, ctx) => sum + ctx.content.length / 4, 0);

      // Extract topics
      const allTopics = userContexts.flatMap(ctx => this.extractTopics(ctx.content));
      const topTopics = this.getMostFrequentItems(allTopics, 5);

      // Calculate efficiency metrics
      const compressionEvents = userContexts.filter(ctx =>
        ctx.metadata?.summaryType === 'compressed_conversation'
      );

      const compressionSavings = compressionEvents.reduce((sum, event) => {
        const original = event.metadata?.originalTokens || 0;
        const compressed = event.metadata?.compressedTokens || 0;
        return sum + (original - compressed);
      }, 0);

      return {
        userId,
        sessionCount: sessionIds.length,
        messageCount,
        totalTokens,
        contextCompressions: compressionEvents.length,
        averageSessionDuration: this.calculateAverageSessionDuration(userContexts),
        lastActivity: userContexts.length > 0
          ? new Date(Math.max(...userContexts.map(ctx => new Date(ctx.updated_at).getTime())))
          : new Date(0),
        topTopics,
        efficiency: {
          compressionSavings,
          retrievalAccuracy: 0.85, // Placeholder - would need to track this
          contextRelevance: 0.78, // Placeholder - would need to track this
        },
      };
    } catch (error) {
      log.error('❌ Failed to get user analytics', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });

      return {
        userId,
        sessionCount: 0,
        messageCount: 0,
        totalTokens: 0,
        contextCompressions: 0,
        averageSessionDuration: 0,
        lastActivity: new Date(0),
        topTopics: [],
        efficiency: {
          compressionSavings: 0,
          retrievalAccuracy: 0,
          contextRelevance: 0,
        },
      };
    }
  }

  /**
   * Get compression analytics
   */
  async getCompressionAnalytics(timeWindow = 7): Promise<CompressionAnalytics> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - timeWindow);

      // Get compression events from database
      const { data: compressions, error } = await this.supabase
        .from('context_storage')
        .select('*')
        .eq('category', 'conversation')
        .not('metadata->>summaryType', 'is', null)
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const compressionData = compressions || [];

      // Calculate metrics
      let totalTokensSaved = 0;
      let totalCompressionRatio = 0;
      const compressionsByType: Record<string, number> = {};
      const dailyCompressions = new Map<string, { count: number; tokensSaved: number; totalRatio: number }>();

      compressionData.forEach(compression => {
        const metadata = compression.metadata || {};
        const originalTokens = metadata.originalTokens || 0;
        const compressedTokens = metadata.compressedTokens || 0;
        const ratio = metadata.compressionRatio || 0;
        const type = metadata.summaryType || 'unknown';

        totalTokensSaved += (originalTokens - compressedTokens);
        totalCompressionRatio += ratio;
        compressionsByType[type] = (compressionsByType[type] || 0) + 1;

        // Daily aggregation
        const date = compression.created_at.split('T')[0];
        const daily = dailyCompressions.get(date) || { count: 0, tokensSaved: 0, totalRatio: 0 };
        daily.count += 1;
        daily.tokensSaved += (originalTokens - compressedTokens);
        daily.totalRatio += ratio;
        dailyCompressions.set(date, daily);
      });

      // Build trends
      const compressionTrends = Array.from(dailyCompressions.entries()).map(([date, data]) => ({
        date: new Date(date),
        compressions: data.count,
        ratio: data.count > 0 ? data.totalRatio / data.count : 0,
        tokensSaved: data.tokensSaved,
      })).sort((a, b) => a.date.getTime() - b.date.getTime());

      return {
        totalCompressions: compressionData.length,
        averageCompressionRatio: compressionData.length > 0 ? totalCompressionRatio / compressionData.length : 0,
        tokensSaved: totalTokensSaved,
        compressionsByType,
        compressionTrends,
      };
    } catch (error) {
      log.error('❌ Failed to get compression analytics', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        totalCompressions: 0,
        averageCompressionRatio: 0,
        tokensSaved: 0,
        compressionsByType: {},
        compressionTrends: [],
      };
    }
  }

  /**
   * Get retrieval analytics
   */
  async getRetrievalAnalytics(): Promise<RetrievalAnalytics> {
    try {
      // Calculate from recent events
      const recentEvents = this.retrievalEvents.filter(
        event => Date.now() - event.timestamp.getTime() < 24 * 60 * 60 * 1000
      );

      const totalQueries = recentEvents.length;
      const averageResponseTime = totalQueries > 0
        ? recentEvents.reduce((sum, event) => sum + event.queryTime, 0) / totalQueries
        : 0;

      const averageResults = totalQueries > 0
        ? recentEvents.reduce((sum, event) => sum + event.resultCount, 0) / totalQueries
        : 0;

      // Get cache stats
      const cacheStats = semanticContextRetrievalService.getCacheStats();

      return {
        totalQueries,
        averageResponseTime,
        averageResults,
        averageRelevance: 0.75, // Placeholder - would need feedback tracking
        cacheHitRate: cacheStats.hitRate,
        semanticSearchUsage: 0.85, // Placeholder - would need to track fallback rate
        fallbackRate: 0.15, // Placeholder
        topQueryTypes: {
          'code': 35,
          'documentation': 25,
          'conversation': 20,
          'error_analysis': 15,
          'other': 5,
        },
      };
    } catch (error) {
      log.error('❌ Failed to get retrieval analytics', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        totalQueries: 0,
        averageResponseTime: 0,
        averageResults: 0,
        averageRelevance: 0,
        cacheHitRate: 0,
        semanticSearchUsage: 0,
        fallbackRate: 0,
        topQueryTypes: {},
      };
    }
  }

  /**
   * Get system health metrics
   */
  async getSystemHealth(): Promise<SystemHealthMetrics> {
    try {
      const [
        contextManagerStats,
        semanticCacheStats,
        databaseStats,
        middlewareStats
      ] = await Promise.all([
        this.getContextManagerStats(),
        this.getSemanticCacheStats(),
        this.getDatabaseStats(),
        this.getMiddlewareStats()
      ]);

      return {
        contextManager: {
          status: this.assessContextManagerHealth(contextManagerStats),
          activeContexts: contextManagerStats.activeContexts,
          memoryUsage: this.estimateMemoryUsage(contextManagerStats),
          compressionBacklog: this.estimateCompressionBacklog(contextManagerStats),
        },
        semanticRetrieval: {
          status: this.assessSemanticRetrievalHealth(semanticCacheStats),
          cacheSize: semanticCacheStats.size,
          embeddingFailures: 0, // Would need to track this
          averageQueryTime: this.getAverageResponseTime(),
        },
        database: {
          status: this.assessDatabaseHealth(databaseStats),
          totalRecords: databaseStats.totalRecords,
          storageSize: databaseStats.totalSize,
          queryPerformance: databaseStats.averageQueryTime,
        },
        middleware: {
          status: this.assessMiddlewareHealth(middlewareStats),
          activeSessions: middlewareStats.activeSessions,
          requestsPerMinute: this.calculateRequestsPerMinute(),
          errorRate: 0.02, // Placeholder - would need error tracking
        },
      };
    } catch (error) {
      log.error('❌ Failed to get system health metrics', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        contextManager: { status: 'critical', activeContexts: 0, memoryUsage: 0, compressionBacklog: 0 },
        semanticRetrieval: { status: 'critical', cacheSize: 0, embeddingFailures: 0, averageQueryTime: 0 },
        database: { status: 'critical', totalRecords: 0, storageSize: 0, queryPerformance: 0 },
        middleware: { status: 'critical', activeSessions: 0, requestsPerMinute: 0, errorRate: 1 },
      };
    }
  }

  /**
   * Get cost optimization recommendations
   */
  async getCostOptimization(): Promise<CostOptimization> {
    try {
      const [metrics, compressionAnalytics, retrievalAnalytics] = await Promise.all([
        this.getCurrentMetrics(),
        this.getCompressionAnalytics(),
        this.getRetrievalAnalytics(),
      ]);

      const potentialSavings = {
        tokenCompressionSavings: compressionAnalytics.tokensSaved * 0.001, // Assuming $0.001 per token
        storageOptimization: metrics.databaseSize * 0.1 * 0.05, // 10% reduction at $0.05/MB
        cacheEfficiency: (1 - metrics.cacheHitRate) * retrievalAnalytics.totalQueries * 0.002, // Cache misses cost
      };

      const recommendations = [];

      // Compression recommendations
      if (metrics.compressionRatio < 0.3) {
        recommendations.push({
          type: 'compression' as const,
          impact: 'high' as const,
          description: 'Increase compression aggressiveness to reduce token usage',
          estimatedSavings: potentialSavings.tokenCompressionSavings * 2,
        });
      }

      // Storage recommendations
      if (metrics.databaseSize > 1000) { // > 1GB
        recommendations.push({
          type: 'storage' as const,
          impact: 'medium' as const,
          description: 'Implement automated cleanup of old context data',
          estimatedSavings: potentialSavings.storageOptimization,
        });
      }

      // Caching recommendations
      if (metrics.cacheHitRate < 0.7) {
        recommendations.push({
          type: 'caching' as const,
          impact: 'medium' as const,
          description: 'Increase cache size and TTL for better hit rates',
          estimatedSavings: potentialSavings.cacheEfficiency,
        });
      }

      // Retrieval recommendations
      if (retrievalAnalytics.averageResponseTime > 1000) {
        recommendations.push({
          type: 'retrieval' as const,
          impact: 'low' as const,
          description: 'Optimize semantic search indexing for faster retrieval',
          estimatedSavings: 0.05, // Small but consistent savings
        });
      }

      return {
        potentialSavings,
        recommendations: recommendations.sort((a, b) => b.estimatedSavings - a.estimatedSavings),
      };
    } catch (error) {
      log.error('❌ Failed to get cost optimization', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        potentialSavings: {
          tokenCompressionSavings: 0,
          storageOptimization: 0,
          cacheEfficiency: 0,
        },
        recommendations: [],
      };
    }
  }

  /**
   * Track a retrieval event for analytics
   */
  trackRetrievalEvent(queryTime: number, resultCount: number, relevanceScore?: number): void {
    this.retrievalEvents.push({
      timestamp: new Date(),
      queryTime,
      resultCount,
    });

    // Keep only recent events
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    this.retrievalEvents = this.retrievalEvents.filter(
      event => event.timestamp.getTime() > cutoff
    );

    // Update response times
    this.queryResponseTimes.push(queryTime);
    if (this.queryResponseTimes.length > 100) {
      this.queryResponseTimes.shift();
    }
  }

  /**
   * Track a compression event for analytics
   */
  trackCompressionEvent(compressionRatio: number, tokensSaved: number): void {
    this.compressionEvents.push({
      timestamp: new Date(),
      ratio: compressionRatio,
      tokensSaved,
    });

    // Keep only recent events
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    this.compressionEvents = this.compressionEvents.filter(
      event => event.timestamp.getTime() > cutoff
    );
  }

  /**
   * Get metrics history for trend analysis
   */
  getMetricsHistory(hours = 24): ContextMetrics[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.metricsHistory.filter(
      metrics => metrics.timestamp.getTime() > cutoff
    );
  }

  /**
   * Export analytics data for external analysis
   */
  async exportAnalyticsData(format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        currentMetrics: await this.getCurrentMetrics(),
        metricsHistory: this.getMetricsHistory(168), // 7 days
        compressionAnalytics: await this.getCompressionAnalytics(),
        retrievalAnalytics: await this.getRetrievalAnalytics(),
        systemHealth: await this.getSystemHealth(),
        costOptimization: await this.getCostOptimization(),
      };

      if (format === 'csv') {
        return this.convertToCSV(data);
      }

      return JSON.stringify(data, null, 2);
    } catch (error) {
      log.error('❌ Failed to export analytics data', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        format,
      });
      throw error;
    }
  }

  // Private helper methods

  private async getContextManagerStats() {
    try {
      return enhancedContextManager.getStats();
    } catch (error) {
      return { activeContexts: 0, totalMessages: 0, totalTokens: 0, averageCompression: 0 };
    }
  }

  private async getMiddlewareStats() {
    try {
      return autoContextMiddleware.getStats();
    } catch (error) {
      return { activeSessions: 0, totalMessages: 0, averageTokensPerSession: 0, compressionRate: 0 };
    }
  }

  private async getSemanticCacheStats() {
    try {
      return semanticContextRetrievalService.getCacheStats();
    } catch (error) {
      return { size: 0, hitRate: 0, memoryUsage: 0 };
    }
  }

  private async getDatabaseStats(): Promise<{
    totalRecords: number;
    totalSize: number;
    averageQueryTime: number;
  }> {
    try {
      const { data: contextCount } = await this.supabase
        .from('context_storage')
        .select('*', { count: 'exact', head: true });

      const { data: memoryCount } = await this.supabase
        .from('ai_memories')
        .select('*', { count: 'exact', head: true });

      // Estimate storage size (rough approximation)
      const stats = await contextStorageService.getContextStats('system'); // Get system stats
      const totalSize = stats.totalEntries * 0.001; // Rough estimate: 1KB per entry

      return {
        totalRecords: (contextCount?.length || 0) + (memoryCount?.length || 0),
        totalSize,
        averageQueryTime: 50, // Placeholder - would need query performance tracking
      };
    } catch (error) {
      return { totalRecords: 0, totalSize: 0, averageQueryTime: 0 };
    }
  }

  private countUniqueUsers(middlewareStats: any): number {
    // Placeholder - would need to track unique users properly
    return Math.ceil(middlewareStats.activeSessions * 0.7);
  }

  private getAverageResponseTime(): number {
    if (this.queryResponseTimes.length === 0) return 0;
    return this.queryResponseTimes.reduce((sum, time) => sum + time, 0) / this.queryResponseTimes.length;
  }

  private extractTopics(content: string): string[] {
    const topics: string[] = [];
    const lowerContent = content.toLowerCase();

    const topicKeywords = [
      'authentication', 'database', 'api', 'frontend', 'backend',
      'error', 'bug', 'testing', 'deployment', 'security'
    ];

    topicKeywords.forEach(keyword => {
      if (lowerContent.includes(keyword)) {
        topics.push(keyword);
      }
    });

    return topics;
  }

  private getMostFrequentItems<T>(items: T[], limit: number): T[] {
    const counts = new Map<T, number>();
    items.forEach(item => counts.set(item, (counts.get(item) || 0) + 1));

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([item]) => item);
  }

  private calculateAverageSessionDuration(contexts: any[]): number {
    if (contexts.length < 2) return 0;

    const timestamps = contexts.map(ctx => new Date(ctx.created_at).getTime()).sort();
    const firstTimestamp = timestamps[0];
    const lastTimestamp = timestamps[timestamps.length - 1];

    if (firstTimestamp === undefined || lastTimestamp === undefined) return 0;
    const duration = lastTimestamp - firstTimestamp;

    return duration / (60 * 1000); // Convert to minutes
  }

  private assessContextManagerHealth(stats: any): 'healthy' | 'warning' | 'critical' {
    if (stats.activeContexts > 100) return 'warning';
    if (stats.totalTokens > 1000000) return 'warning';
    if (stats.averageCompression < 0.1) return 'critical';
    return 'healthy';
  }

  private assessSemanticRetrievalHealth(stats: any): 'healthy' | 'warning' | 'critical' {
    if (stats.memoryUsage > 100) return 'warning'; // > 100MB
    if (stats.hitRate < 0.3) return 'warning';
    if (stats.size === 0) return 'critical';
    return 'healthy';
  }

  private assessDatabaseHealth(stats: any): 'healthy' | 'warning' | 'critical' {
    if (stats.totalSize > 5000) return 'warning'; // > 5GB
    if (stats.averageQueryTime > 1000) return 'warning';
    if (stats.totalRecords === 0) return 'critical';
    return 'healthy';
  }

  private assessMiddlewareHealth(stats: any): 'healthy' | 'warning' | 'critical' {
    if (stats.activeSessions > 1000) return 'warning';
    if (stats.activeSessions === 0) return 'warning';
    return 'healthy';
  }

  private estimateMemoryUsage(stats: any): number {
    // Rough estimation: 1KB per message + overhead
    return (stats.totalMessages * 1 + stats.activeContexts * 5) / 1024; // MB
  }

  private estimateCompressionBacklog(stats: any): number {
    // Estimate contexts that need compression based on size
    return Math.max(0, Math.floor(stats.totalTokens / 6000) - (stats.totalMessages * 0.1));
  }

  private calculateRequestsPerMinute(): number {
    // Placeholder - would need to track request counts
    return 25;
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion for metrics
    const lines = ['timestamp,metric,value'];

    // Add current metrics
    const current = data.currentMetrics;
    Object.entries(current).forEach(([key, value]) => {
      if (key !== 'timestamp' && typeof value === 'number') {
        lines.push(`${current.timestamp},${key},${value}`);
      }
    });

    return lines.join('\n');
  }

  private startMetricsCollection(): void {
    this.collectionTimer = setInterval(async () => {
      try {
        await this.getCurrentMetrics();
      } catch (error) {
        log.error('❌ Metrics collection failed', LogContext.CONTEXT_INJECTION, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.COLLECTION_INTERVAL);

    log.info('📈 Metrics collection started', LogContext.CONTEXT_INJECTION, {
      interval: this.COLLECTION_INTERVAL,
    });
  }

  /**
   * Shutdown the analytics service
   */
  public shutdown(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = undefined;
    }

    this.metricsHistory.length = 0;
    this.queryResponseTimes.length = 0;
    this.compressionEvents.length = 0;
    this.retrievalEvents.length = 0;

    log.info('🛑 Context Analytics Service shutdown complete', LogContext.CONTEXT_INJECTION);
  }
}

// Export singleton instance
export const contextAnalyticsService = new ContextAnalyticsService();
export default contextAnalyticsService;

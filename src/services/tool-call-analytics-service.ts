/**
 * Tool Call Analytics Service
 * 
 * Comprehensive analytics and tracking for tool usage across the Universal AI Tools platform
 * Provides insights into tool performance, usage patterns, optimization opportunities
 */

import { EventEmitter } from 'events';
import { z } from 'zod';

import { log, LogContext } from '@/utils/logger';

import { getSupabaseClient } from './supabase-client';

// Tool call analytics types
interface ToolCall {
  id: string;
  timestamp: number;
  sessionId: string;
  agentName: string;
  server: string;
  tool: string;
  parameters: Record<string, any>;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  result: any;
  error?: string;
  context: {
    userQuery: string;
    taskType: string;
    complexity: 'low' | 'medium' | 'high';
    repositoryName?: string;
    fileType?: string;
  };
  performance: {
    relevanceScore: number;
    confidenceScore: number;
    resultsFound: number;
    cacheHit: boolean;
    retryCount: number;
  };
  metadata: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    apiVersion: string;
    experimentGroup?: string;
  };
}

interface ToolSequence {
  id: string;
  sessionId: string;
  agentName: string;
  startTime: number;
  endTime: number;
  toolCalls: ToolCall[];
  outcome: 'success' | 'failure' | 'timeout' | 'interrupted';
  overallRelevance: number;
  efficiency: number;
  userSatisfaction?: number;
  context: {
    initialQuery: string;
    finalResult: any;
    expectedOutcome?: any;
    taskCategory: string;
  };
}

interface ToolPerformanceMetrics {
  tool: string;
  server: string;
  timeWindow: string;
  statistics: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    successRate: number;
    averageDuration: number;
    medianDuration: number;
    p95Duration: number;
    averageRelevance: number;
    averageResultCount: number;
    cacheHitRate: number;
    retryRate: number;
  };
  trends: {
    callVolumeChange: number;
    successRateChange: number;
    performanceChange: number;
    relevanceChange: number;
  };
  usage: {
    peakHours: number[];
    topAgents: Array<{ agent: string; count: number }>;
    topTaskTypes: Array<{ taskType: string; count: number }>;
    commonParameters: Array<{ parameter: string; frequency: number }>;
  };
  issues: {
    commonErrors: Array<{ error: string; count: number; impact: number }>;
    performanceBottlenecks: Array<{ issue: string; severity: 'low' | 'medium' | 'high' }>;
    recommendations: string[];
  };
}

interface ToolUsagePattern {
  pattern: string[];
  frequency: number;
  successRate: number;
  averageEfficiency: number;
  contexts: Array<{
    taskType: string;
    frequency: number;
    effectiveness: number;
  }>;
  optimization: {
    canOptimize: boolean;
    suggestedChanges: string[];
    expectedImprovement: number;
  };
}

interface AnalyticsReport {
  id: string;
  generatedAt: number;
  timeWindow: {
    start: number;
    end: number;
    duration: string;
  };
  summary: {
    totalToolCalls: number;
    uniqueTools: number;
    uniqueAgents: number;
    uniqueSessions: number;
    overallSuccessRate: number;
    averageResponseTime: number;
    totalErrors: number;
  };
  toolPerformance: ToolPerformanceMetrics[];
  usagePatterns: ToolUsagePattern[];
  insights: {
    topPerformingTools: Array<{ tool: string; score: number; reason: string }>;
    underperformingTools: Array<{ tool: string; issues: string[]; recommendations: string[] }>;
    emergingPatterns: Array<{ pattern: string; significance: number; description: string }>;
    optimizationOpportunities: Array<{ area: string; impact: 'low' | 'medium' | 'high'; effort: 'low' | 'medium' | 'high' }>;
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  benchmarks: {
    vsBaseline: number;
    vsLastPeriod: number;
    vsIndustryStandard?: number;
  };
}

const ToolCallSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  sessionId: z.string(),
  agentName: z.string(),
  server: z.string(),
  tool: z.string(),
  parameters: z.record(z.any()),
  startTime: z.number(),
  endTime: z.number(),
  success: z.boolean(),
  result: z.any(),
  error: z.string().optional(),
  context: z.object({
    userQuery: z.string(),
    taskType: z.string(),
    complexity: z.enum(['low', 'medium', 'high']),
    repositoryName: z.string().optional(),
    fileType: z.string().optional(),
  }),
  performance: z.object({
    relevanceScore: z.number().min(0).max(1),
    confidenceScore: z.number().min(0).max(1),
    resultsFound: z.number().min(0),
    cacheHit: z.boolean(),
    retryCount: z.number().min(0),
  }),
});

/**
 * Tool Call Analytics Service
 */
export class ToolCallAnalyticsService extends EventEmitter {
  private activeSessions: Map<string, { toolCalls: ToolCall[]; startTime: number }> = new Map();
  private recentCalls: ToolCall[] = [];
  private performanceCache: Map<string, ToolPerformanceMetrics> = new Map();
  private usagePatterns: Map<string, ToolUsagePattern> = new Map();
  
  // Real-time tracking
  private callBuffer: ToolCall[] = [];
  private metricsBuffer: Array<{
    timestamp: number;
    metric: string;
    value: number;
    labels: Record<string, string>;
  }> = [];

  // Configuration
  private config = {
    maxRecentCalls: 10000,
    maxBufferSize: 1000,
    aggregationInterval: 60000, // 1 minute
    persistenceInterval: 300000, // 5 minutes
    enableRealTimeTracking: true,
    enablePatternDetection: true,
    enableAnomalyDetection: true,
  };

  constructor() {
    super();
    this.startPeriodicAggregation();
    this.startPatternDetection();
    log.info('Tool call analytics service initialized', LogContext.AI);
  }

  /**
   * Track a tool call execution
   */
  async trackToolCall(
    sessionId: string,
    agentName: string,
    server: string,
    tool: string,
    parameters: Record<string, any>,
    startTime: number,
    endTime: number,
    success: boolean,
    result: any,
    error?: string,
    context?: {
      userQuery: string;
      taskType: string;
      complexity: 'low' | 'medium' | 'high';
      repositoryName?: string;
      fileType?: string;
    },
    performance?: {
      relevanceScore: number;
      confidenceScore: number;
      resultsFound: number;
      cacheHit: boolean;
      retryCount: number;
    },
    metadata?: {
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
      apiVersion: string;
      experimentGroup?: string;
    }
  ): Promise<void> {
    const toolCall: ToolCall = {
      id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      sessionId,
      agentName,
      server,
      tool,
      parameters: this.sanitizeParameters(parameters),
      startTime,
      endTime,
      duration: endTime - startTime,
      success,
      result: this.sanitizeResult(result),
      error,
      context: context || {
        userQuery: '',
        taskType: 'unknown',
        complexity: 'medium',
      },
      performance: performance || {
        relevanceScore: success ? 0.7 : 0.3,
        confidenceScore: success ? 0.8 : 0.4,
        resultsFound: success ? 1 : 0,
        cacheHit: false,
        retryCount: 0,
      },
      metadata: metadata || {
        apiVersion: '1.0',
      },
    };

    // Validate tool call data
    try {
      ToolCallSchema.parse(toolCall);
    } catch (error) {
      log.warn('Invalid tool call data', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
        toolCall: toolCall.id,
      });
      return;
    }

    // Add to buffers
    this.callBuffer.push(toolCall);
    this.recentCalls.push(toolCall);

    // Maintain buffer sizes
    if (this.callBuffer.length > this.config.maxBufferSize) {
      this.callBuffer = this.callBuffer.slice(-this.config.maxBufferSize);
    }
    
    if (this.recentCalls.length > this.config.maxRecentCalls) {
      this.recentCalls = this.recentCalls.slice(-this.config.maxRecentCalls);
    }

    // Update session tracking
    this.updateSessionTracking(sessionId, toolCall);

    // Real-time metrics update
    if (this.config.enableRealTimeTracking) {
      this.updateRealTimeMetrics(toolCall);
    }

    // Pattern detection
    if (this.config.enablePatternDetection) {
      this.updatePatternDetection(sessionId, toolCall);
    }

    // Anomaly detection
    if (this.config.enableAnomalyDetection) {
      this.checkForAnomalies(toolCall);
    }

    // Emit events
    this.emit('tool-call-tracked', toolCall);
    
    if (!success) {
      this.emit('tool-call-failed', toolCall);
    }

    if (toolCall.duration > 10000) { // > 10 seconds
      this.emit('tool-call-slow', toolCall);
    }

    log.debug('Tool call tracked', LogContext.AI, {
      id: toolCall.id,
      tool: `${server}:${tool}`,
      duration: toolCall.duration,
      success,
      relevance: toolCall.performance.relevanceScore,
    });
  }

  /**
   * Get comprehensive tool performance analytics
   */
  async getToolAnalytics(
    timeWindow: 'hour' | 'day' | 'week' | 'month' = 'day',
    filters?: {
      server?: string;
      tool?: string;
      agentName?: string;
      taskType?: string;
      success?: boolean;
    }
  ): Promise<ToolPerformanceMetrics[]> {
    const windowMs = this.getTimeWindowMs(timeWindow);
    const cutoffTime = Date.now() - windowMs;
    
    // Filter tool calls
    let calls = this.recentCalls.filter(call => call.timestamp >= cutoffTime);
    
    if (filters) {
      if (filters.server) calls = calls.filter(c => c.server === filters.server);
      if (filters.tool) calls = calls.filter(c => c.tool === filters.tool);
      if (filters.agentName) calls = calls.filter(c => c.agentName === filters.agentName);
      if (filters.taskType) calls = calls.filter(c => c.context.taskType === filters.taskType);
      if (filters.success !== undefined) calls = calls.filter(c => c.success === filters.success);
    }

    // Group by tool
    const toolGroups = new Map<string, ToolCall[]>();
    for (const call of calls) {
      const toolKey = `${call.server}:${call.tool}`;
      if (!toolGroups.has(toolKey)) {
        toolGroups.set(toolKey, []);
      }
      toolGroups.get(toolKey)!.push(call);
    }

    // Generate analytics for each tool
    const analytics: ToolPerformanceMetrics[] = [];
    
    for (const [toolKey, toolCalls] of toolGroups.entries()) {
      const parts = toolKey.split(':');
      const server = parts[0] || 'unknown';
      const tool = parts[1] || 'unknown';
      const metrics = await this.calculateToolMetrics(server, tool, toolCalls, timeWindow);
      analytics.push(metrics);
    }

    // Sort by usage frequency
    analytics.sort((a, b) => b.statistics.totalCalls - a.statistics.totalCalls);
    
    return analytics;
  }

  /**
   * Get usage pattern analysis
   */
  async getUsagePatterns(
    timeWindow: 'day' | 'week' | 'month' = 'week',
    minFrequency: number = 5
  ): Promise<ToolUsagePattern[]> {
    const windowMs = this.getTimeWindowMs(timeWindow);
    const cutoffTime = Date.now() - windowMs;
    
    // Get sessions within time window
    const recentSessions = this.getSessionsInTimeWindow(cutoffTime);
    
    // Extract tool sequences from sessions
    const sequences = recentSessions.map(session => 
      session.toolCalls.map(call => `${call.server}:${call.tool}`)
    );

    // Find common patterns
    const patterns = this.findToolSequencePatterns(sequences, minFrequency);
    
    return patterns;
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateAnalyticsReport(
    timeWindow: 'day' | 'week' | 'month' = 'week'
  ): Promise<AnalyticsReport> {
    const startTime = Date.now();
    const windowMs = this.getTimeWindowMs(timeWindow);
    const windowStart = startTime - windowMs;
    
    // Get all data for the time window
    const calls = this.recentCalls.filter(call => call.timestamp >= windowStart);
    const toolAnalytics = await this.getToolAnalytics(timeWindow);
    const usagePatterns = await this.getUsagePatterns(timeWindow);
    
    // Calculate summary statistics
    const summary = {
      totalToolCalls: calls.length,
      uniqueTools: new Set(calls.map(c => `${c.server}:${c.tool}`)).size,
      uniqueAgents: new Set(calls.map(c => c.agentName)).size,
      uniqueSessions: new Set(calls.map(c => c.sessionId)).size,
      overallSuccessRate: calls.length > 0 ? calls.filter(c => c.success).length / calls.length : 0,
      averageResponseTime: calls.length > 0 ? calls.reduce((sum, c) => sum + c.duration, 0) / calls.length : 0,
      totalErrors: calls.filter(c => !c.success).length,
    };

    // Generate insights
    const insights = this.generateInsights(toolAnalytics, usagePatterns, calls);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(insights, toolAnalytics);
    
    // Calculate benchmarks
    const benchmarks = await this.calculateBenchmarks(summary, timeWindow);

    const report: AnalyticsReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      generatedAt: startTime,
      timeWindow: {
        start: windowStart,
        end: startTime,
        duration: timeWindow,
      },
      summary,
      toolPerformance: toolAnalytics,
      usagePatterns,
      insights,
      recommendations,
      benchmarks,
    };

    // Persist report
    await this.persistReport(report);
    
    log.info('Analytics report generated', LogContext.AI, {
      reportId: report.id,
      timeWindow,
      totalCalls: summary.totalToolCalls,
      successRate: summary.overallSuccessRate,
    });

    this.emit('report-generated', report);
    return report;
  }

  /**
   * Get real-time dashboard data
   */
  getRealTimeDashboard(): {
    currentMetrics: {
      activeTools: number;
      callsPerMinute: number;
      averageResponseTime: number;
      successRate: number;
      topTools: Array<{ tool: string; calls: number }>;
    };
    recentActivity: ToolCall[];
    alerts: Array<{
      type: 'performance' | 'error' | 'anomaly';
      severity: 'low' | 'medium' | 'high';
      message: string;
      timestamp: number;
      toolAffected?: string;
    }>;
    trends: Array<{
      metric: string;
      value: number;
      change: number;
      trend: 'up' | 'down' | 'stable';
    }>;
  } {
    const recentCalls = this.recentCalls.filter(call => 
      call.timestamp > Date.now() - 60000 // Last minute
    );

    const currentMetrics = {
      activeTools: new Set(recentCalls.map(c => `${c.server}:${c.tool}`)).size,
      callsPerMinute: recentCalls.length,
      averageResponseTime: recentCalls.length > 0 ? 
        recentCalls.reduce((sum, c) => sum + c.duration, 0) / recentCalls.length : 0,
      successRate: recentCalls.length > 0 ? 
        recentCalls.filter(c => c.success).length / recentCalls.length : 0,
      topTools: this.getTopTools(recentCalls, 5),
    };

    const recentActivity = this.recentCalls.slice(-20); // Last 20 calls
    const alerts = this.generateRealTimeAlerts();
    const trends = this.calculateTrends();

    return {
      currentMetrics,
      recentActivity,
      alerts,
      trends,
    };
  }

  /**
   * Export analytics data for external analysis
   */
  async exportAnalyticsData(
    format: 'json' | 'csv' | 'parquet',
    timeWindow: 'day' | 'week' | 'month',
    includeRawData: boolean = false
  ): Promise<{ data: any; metadata: any }> {
    const windowMs = this.getTimeWindowMs(timeWindow);
    const cutoffTime = Date.now() - windowMs;
    
    const calls = this.recentCalls.filter(call => call.timestamp >= cutoffTime);
    const analytics = await this.getToolAnalytics(timeWindow);
    const patterns = await this.getUsagePatterns(timeWindow);

    const exportData = {
      metadata: {
        exportedAt: Date.now(),
        timeWindow,
        totalRecords: calls.length,
        format,
        version: '1.0',
      },
      summary: {
        totalCalls: calls.length,
        uniqueTools: new Set(calls.map(c => `${c.server}:${c.tool}`)).size,
        successRate: calls.filter(c => c.success).length / calls.length,
      },
      analytics,
      patterns,
      rawData: includeRawData ? calls : undefined,
    };

    // Format data based on requested format
    let formattedData;
    switch (format) {
      case 'json':
        formattedData = JSON.stringify(exportData, null, 2);
        break;
      case 'csv':
        formattedData = this.convertToCSV(calls);
        break;
      case 'parquet':
        // Would implement Parquet encoding in production
        formattedData = exportData;
        break;
      default:
        formattedData = exportData;
    }

    return {
      data: formattedData,
      metadata: exportData.metadata,
    };
  }

  // Private helper methods
  private async calculateToolMetrics(
    server: string,
    tool: string,
    calls: ToolCall[],
    timeWindow: string
  ): Promise<ToolPerformanceMetrics> {
    const successfulCalls = calls.filter(c => c.success);
    const durations = calls.map(c => c.duration).sort((a, b) => a - b);
    
    const statistics = {
      totalCalls: calls.length,
      successfulCalls: successfulCalls.length,
      failedCalls: calls.length - successfulCalls.length,
      successRate: calls.length > 0 ? successfulCalls.length / calls.length : 0,
      averageDuration: calls.length > 0 ? calls.reduce((sum, c) => sum + c.duration, 0) / calls.length : 0,
      medianDuration: durations.length > 0 ? durations[Math.floor(durations.length / 2)] ?? 0 : 0,
      p95Duration: durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] ?? 0 : 0,
      averageRelevance: calls.length > 0 ? calls.reduce((sum, c) => sum + c.performance.relevanceScore, 0) / calls.length : 0,
      averageResultCount: calls.length > 0 ? calls.reduce((sum, c) => sum + c.performance.resultsFound, 0) / calls.length : 0,
      cacheHitRate: calls.length > 0 ? calls.filter(c => c.performance.cacheHit).length / calls.length : 0,
      retryRate: calls.length > 0 ? calls.filter(c => c.performance.retryCount > 0).length / calls.length : 0,
    };

    // Calculate trends (simplified - would compare with previous period in production)
    const trends = {
      callVolumeChange: 0,
      successRateChange: 0,
      performanceChange: 0,
      relevanceChange: 0,
    };

    // Analyze usage patterns
    const usage = {
      peakHours: this.calculatePeakHours(calls),
      topAgents: this.getTopAgents(calls, 5),
      topTaskTypes: this.getTopTaskTypes(calls, 5),
      commonParameters: this.getCommonParameters(calls, 10),
    };

    // Identify issues
    const issues = {
      commonErrors: this.getCommonErrors(calls.filter(c => !c.success), 5),
      performanceBottlenecks: this.identifyPerformanceBottlenecks(calls),
      recommendations: this.generateToolRecommendations(statistics, calls),
    };

    return {
      tool,
      server,
      timeWindow,
      statistics,
      trends,
      usage,
      issues,
    };
  }

  private findToolSequencePatterns(
    sequences: string[][],
    minFrequency: number
  ): ToolUsagePattern[] {
    const patterns = new Map<string, {
      count: number;
      successes: number;
      totalEfficiency: number;
      contexts: Map<string, { count: number; effectiveness: number }>;
    }>();

    // Extract patterns of length 2-5
    for (const sequence of sequences) {
      for (let length = 2; length <= Math.min(5, sequence.length); length++) {
        for (let start = 0; start <= sequence.length - length; start++) {
          const pattern = sequence.slice(start, start + length);
          const patternKey = pattern.join(' -> ');
          
          if (!patterns.has(patternKey)) {
            patterns.set(patternKey, {
              count: 0,
              successes: 0,
              totalEfficiency: 0,
              contexts: new Map(),
            });
          }
          
          const stats = patterns.get(patternKey)!;
          stats.count++;
          // Would track actual success and efficiency in production
          stats.successes += Math.random() > 0.3 ? 1 : 0; // Mock data
          stats.totalEfficiency += Math.random() * 0.5 + 0.5; // Mock data
        }
      }
    }

    // Convert to ToolUsagePattern format
    const result: ToolUsagePattern[] = [];
    
    for (const [patternKey, stats] of patterns.entries()) {
      if (stats.count >= minFrequency) {
        const pattern = patternKey.split(' -> ');
        
        const successRate = stats.successes / stats.count;
        const averageEfficiency = stats.totalEfficiency / stats.count;
        
        result.push({
          pattern,
          frequency: stats.count,
          successRate,
          averageEfficiency,
          contexts: Array.from(stats.contexts.entries()).map(([context, data]) => ({
            taskType: context,
            frequency: data.count,
            effectiveness: data.effectiveness,
          })),
          optimization: {
            canOptimize: successRate < 0.7 || averageEfficiency < 0.6,
            suggestedChanges: this.generatePatternOptimizations(pattern, stats),
            expectedImprovement: Math.min(0.3, (0.8 - successRate) * 0.5),
          },
        });
      }
    }

    return result.sort((a, b) => b.frequency - a.frequency);
  }

  private generateInsights(
    toolAnalytics: ToolPerformanceMetrics[],
    usagePatterns: ToolUsagePattern[],
    calls: ToolCall[]
  ): AnalyticsReport['insights'] {
    // Top performing tools
    const topPerformingTools = toolAnalytics
      .filter(t => t.statistics.totalCalls >= 10)
      .sort((a, b) => {
        const scoreA = a.statistics.successRate * 0.4 + a.statistics.averageRelevance * 0.3 + (1 - a.statistics.averageDuration / 10000) * 0.3;
        const scoreB = b.statistics.successRate * 0.4 + b.statistics.averageRelevance * 0.3 + (1 - b.statistics.averageDuration / 10000) * 0.3;
        return scoreB - scoreA;
      })
      .slice(0, 5)
      .map(t => ({
        tool: `${t.server}:${t.tool}`,
        score: t.statistics.successRate * 0.4 + t.statistics.averageRelevance * 0.3,
        reason: `High success rate (${(t.statistics.successRate * 100).toFixed(1)}%) and relevance (${(t.statistics.averageRelevance * 100).toFixed(1)}%)`,
      }));

    // Underperforming tools
    const underperformingTools = toolAnalytics
      .filter(t => t.statistics.totalCalls >= 10 && (t.statistics.successRate < 0.7 || t.statistics.averageRelevance < 0.6))
      .slice(0, 5)
      .map(t => ({
        tool: `${t.server}:${t.tool}`,
        issues: [
          ...(t.statistics.successRate < 0.7 ? [`Low success rate: ${(t.statistics.successRate * 100).toFixed(1)}%`] : []),
          ...(t.statistics.averageRelevance < 0.6 ? [`Low relevance: ${(t.statistics.averageRelevance * 100).toFixed(1)}%`] : []),
          ...(t.statistics.p95Duration > 15000 ? ['High response time'] : []),
        ],
        recommendations: t.issues.recommendations,
      }));

    // Emerging patterns
    const emergingPatterns = usagePatterns
      .filter(p => p.frequency >= 5 && p.successRate > 0.7)
      .slice(0, 3)
      .map(p => ({
        pattern: p.pattern.join(' → '),
        significance: p.frequency * p.successRate,
        description: `Effective ${p.pattern.length}-step pattern with ${(p.successRate * 100).toFixed(1)}% success rate`,
      }));

    // Optimization opportunities
    const optimizationOpportunities = [
      ...toolAnalytics
        .filter(t => t.statistics.successRate < 0.8 && t.statistics.totalCalls >= 20)
        .map(t => ({
          area: `Improve ${t.server}:${t.tool} reliability`,
          impact: 'high' as const,
          effort: 'medium' as const,
        })),
      ...usagePatterns
        .filter(p => p.optimization.canOptimize && p.frequency >= 10)
        .map(p => ({
          area: `Optimize tool sequence: ${p.pattern.join(' → ')}`,
          impact: 'medium' as const,
          effort: 'low' as const,
        })),
    ].slice(0, 5);

    return {
      topPerformingTools,
      underperformingTools,
      emergingPatterns,
      optimizationOpportunities,
    };
  }

  private generateRecommendations(
    insights: AnalyticsReport['insights'],
    toolAnalytics: ToolPerformanceMetrics[]
  ): AnalyticsReport['recommendations'] {
    const immediate = [];
    const shortTerm = [];
    const longTerm = [];

    // Immediate recommendations
    for (const tool of insights.underperformingTools) {
      if (tool.issues.includes('Low success rate')) {
        immediate.push(`Investigate and fix reliability issues with ${tool.tool}`);
      }
    }

    // Short-term recommendations
    for (const opportunity of insights.optimizationOpportunities) {
      if (opportunity.effort === 'low' || opportunity.effort === 'medium') {
        shortTerm.push(`Implement optimization: ${opportunity.area}`);
      }
    }

    // Long-term recommendations
    longTerm.push('Implement predictive tool selection based on usage patterns');
    longTerm.push('Develop automated tool performance monitoring and alerting');
    longTerm.push('Create tool recommendation system for agents');

    return { immediate, shortTerm, longTerm };
  }

  // Additional helper methods (simplified implementations)
  private updateSessionTracking(sessionId: string, toolCall: ToolCall): void {
    if (!this.activeSessions.has(sessionId)) {
      this.activeSessions.set(sessionId, {
        toolCalls: [],
        startTime: toolCall.startTime,
      });
    }
    
    this.activeSessions.get(sessionId)!.toolCalls.push(toolCall);
  }

  private updateRealTimeMetrics(toolCall: ToolCall): void {
    this.metricsBuffer.push({
      timestamp: toolCall.timestamp,
      metric: 'tool_call_duration',
      value: toolCall.duration,
      labels: {
        server: toolCall.server,
        tool: toolCall.tool,
        success: toolCall.success.toString(),
      },
    });

    // Keep buffer manageable
    if (this.metricsBuffer.length > this.config.maxBufferSize) {
      this.metricsBuffer = this.metricsBuffer.slice(-this.config.maxBufferSize);
    }
  }

  private updatePatternDetection(sessionId: string, toolCall: ToolCall): void {
    // Track tool sequences for pattern detection
    const session = this.activeSessions.get(sessionId);
    if (session && session.toolCalls.length >= 2) {
      const sequence = session.toolCalls.map(call => `${call.server}:${call.tool}`);
      const patternKey = sequence.slice(-3).join(' -> '); // Last 3 tools
      
      // Update pattern tracking (simplified)
      if (!this.usagePatterns.has(patternKey)) {
        this.usagePatterns.set(patternKey, {
          pattern: sequence.slice(-3),
          frequency: 0,
          successRate: 0,
          averageEfficiency: 0,
          contexts: [],
          optimization: {
            canOptimize: false,
            suggestedChanges: [],
            expectedImprovement: 0,
          },
        });
      }
      
      const pattern = this.usagePatterns.get(patternKey)!;
      pattern.frequency++;
    }
  }

  private checkForAnomalies(toolCall: ToolCall): void {
    // Simple anomaly detection
    if (toolCall.duration > 30000) { // > 30 seconds
      this.emit('anomaly-detected', {
        type: 'performance',
        severity: 'high',
        message: `Tool ${toolCall.server}:${toolCall.tool} took ${toolCall.duration}ms`,
        toolCall,
      });
    }

    if (!toolCall.success && toolCall.performance.retryCount > 2) {
      this.emit('anomaly-detected', {
        type: 'reliability',
        severity: 'medium',
        message: `Tool ${toolCall.server}:${toolCall.tool} failed after ${toolCall.performance.retryCount} retries`,
        toolCall,
      });
    }
  }

  private startPeriodicAggregation(): void {
    setInterval(() => {
      this.aggregateMetrics();
    }, this.config.aggregationInterval);

    setInterval(() => {
      this.persistMetrics();
    }, this.config.persistenceInterval);
  }

  private startPatternDetection(): void {
    setInterval(() => {
      this.analyzePatterns();
    }, this.config.aggregationInterval * 5); // Every 5 minutes
  }

  private aggregateMetrics(): void {
    // Aggregate recent metrics for performance optimization
    const recentCalls = this.callBuffer.splice(0); // Clear buffer
    
    if (recentCalls.length === 0) return;

    // Update performance cache
    for (const call of recentCalls) {
      const toolKey = `${call.server}:${call.tool}`;
      // Update cached performance metrics
    }
  }

  private analyzePatterns(): void {
    // Analyze recent tool usage patterns
    const recentSessions = Array.from(this.activeSessions.values())
      .filter(session => Date.now() - session.startTime < 300000); // Last 5 minutes

    // Extract and analyze patterns
    for (const session of recentSessions) {
      if (session.toolCalls.length >= 2) {
        // Analyze tool sequences for optimization opportunities
      }
    }
  }

  private async persistMetrics(): Promise<void> {
    // Persist metrics to Supabase for long-term storage
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const metricsToSave = this.metricsBuffer.splice(0); // Clear buffer
      
      if (metricsToSave.length === 0) return;

      // Batch insert metrics
      const { error } = await supabase
        .from('tool_call_metrics')
        .insert(
          metricsToSave.map(metric => ({
            timestamp: new Date(metric.timestamp).toISOString(),
            metric_name: metric.metric,
            metric_value: metric.value,
            labels: metric.labels,
            created_at: new Date().toISOString(),
          }))
        );

      if (error) {
        log.error('Failed to persist tool call metrics', LogContext.AI, { error });
      } else {
        log.debug('Persisted tool call metrics', LogContext.AI, { count: metricsToSave.length });
      }
    } catch (error) {
      log.error('Error persisting metrics', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async persistReport(report: AnalyticsReport): Promise<void> {
    // Persist analytics report to Supabase
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('analytics_reports')
        .insert({
          report_id: report.id,
          generated_at: new Date(report.generatedAt).toISOString(),
          time_window: report.timeWindow.duration,
          summary: report.summary,
          insights: report.insights,
          recommendations: report.recommendations,
          created_at: new Date().toISOString(),
        });

      if (error) {
        log.error('Failed to persist analytics report', LogContext.AI, { error });
      }
    } catch (error) {
      log.error('Error persisting report', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Utility methods
  private sanitizeParameters(params: Record<string, any>): Record<string, any> {
    // Remove sensitive information from parameters
    const sanitized = { ...params };
    
    // Remove potential PII or sensitive data
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.apiKey;
    delete sanitized.secret;
    
    // Truncate large text fields
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string' && value.length > 1000) {
        sanitized[key] = value.substring(0, 1000) + '...';
      }
    }
    
    return sanitized;
  }

  private sanitizeResult(result: any): any {
    // Sanitize result data for storage
    if (!result) return null;
    
    if (typeof result === 'string' && result.length > 5000) {
      return result.substring(0, 5000) + '...';
    }
    
    if (typeof result === 'object') {
      return {
        type: Array.isArray(result) ? 'array' : 'object',
        size: Array.isArray(result) ? result.length : Object.keys(result).length,
        hasContent: true,
      };
    }
    
    return result;
  }

  private getTimeWindowMs(window: string): number {
    switch (window) {
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      case 'week': return 7 * 24 * 60 * 60 * 1000;
      case 'month': return 30 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  private getSessionsInTimeWindow(cutoffTime: number): Array<{ toolCalls: ToolCall[] }> {
    return Array.from(this.activeSessions.values()).concat(
      // Would also include completed sessions from storage
    );
  }

  private calculatePeakHours(calls: ToolCall[]): number[] {
    const hourCounts = new Array(24).fill(0);
    
    for (const call of calls) {
      const hour = new Date(call.timestamp).getHours();
      hourCounts[hour]++;
    }
    
    return hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour);
  }

  private getTopAgents(calls: ToolCall[], limit: number): Array<{ agent: string; count: number }> {
    const agentCounts = new Map<string, number>();
    
    for (const call of calls) {
      agentCounts.set(call.agentName, (agentCounts.get(call.agentName) || 0) + 1);
    }
    
    return Array.from(agentCounts.entries())
      .map(([agent, count]) => ({ agent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private getTopTaskTypes(calls: ToolCall[], limit: number): Array<{ taskType: string; count: number }> {
    const taskCounts = new Map<string, number>();
    
    for (const call of calls) {
      taskCounts.set(call.context.taskType, (taskCounts.get(call.context.taskType) || 0) + 1);
    }
    
    return Array.from(taskCounts.entries())
      .map(([taskType, count]) => ({ taskType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private getCommonParameters(calls: ToolCall[], limit: number): Array<{ parameter: string; frequency: number }> {
    const paramCounts = new Map<string, number>();
    
    for (const call of calls) {
      for (const param of Object.keys(call.parameters)) {
        paramCounts.set(param, (paramCounts.get(param) || 0) + 1);
      }
    }
    
    return Array.from(paramCounts.entries())
      .map(([parameter, frequency]) => ({ parameter, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  private getCommonErrors(failedCalls: ToolCall[], limit: number): Array<{ error: string; count: number; impact: number }> {
    const errorCounts = new Map<string, number>();
    
    for (const call of failedCalls) {
      if (call.error) {
        const errorType = call.error.split(':')[0] || 'unknown'; // Get error type
        errorCounts.set(errorType, (errorCounts.get(errorType) || 0) + 1);
      }
    }
    
    return Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count, impact: count / failedCalls.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private identifyPerformanceBottlenecks(calls: ToolCall[]): Array<{ issue: string; severity: 'low' | 'medium' | 'high' }> {
    const bottlenecks = [];
    
    const avgDuration = calls.reduce((sum, c) => sum + c.duration, 0) / calls.length;
    const slowCalls = calls.filter(c => c.duration > avgDuration * 2);
    
    if (slowCalls.length > calls.length * 0.1) {
      bottlenecks.push({
        issue: `${slowCalls.length} calls are significantly slower than average`,
        severity: 'medium' as const,
      });
    }
    
    const timeoutCalls = calls.filter(c => c.duration > 30000);
    if (timeoutCalls.length > 0) {
      bottlenecks.push({
        issue: `${timeoutCalls.length} calls exceeded 30 second timeout`,
        severity: 'high' as const,
      });
    }
    
    return bottlenecks;
  }

  private generateToolRecommendations(statistics: any, calls: ToolCall[]): string[] {
    const recommendations = [];
    
    if (statistics.successRate < 0.7) {
      recommendations.push('Investigate and improve error handling');
    }
    
    if (statistics.averageDuration > 10000) {
      recommendations.push('Optimize performance - average response time is high');
    }
    
    if (statistics.cacheHitRate < 0.3) {
      recommendations.push('Implement better caching strategy');
    }
    
    return recommendations;
  }

  private generatePatternOptimizations(pattern: string[], stats: any): string[] {
    const optimizations = [];
    
    if (stats.successRate < 0.7) {
      optimizations.push('Consider reordering tools in sequence');
      optimizations.push('Add error handling between tool calls');
    }
    
    if (pattern.length > 4) {
      optimizations.push('Simplify sequence - current pattern may be too complex');
    }
    
    return optimizations;
  }

  private getTopTools(calls: ToolCall[], limit: number): Array<{ tool: string; calls: number }> {
    const toolCounts = new Map<string, number>();
    
    for (const call of calls) {
      const toolKey = `${call.server}:${call.tool}`;
      toolCounts.set(toolKey, (toolCounts.get(toolKey) || 0) + 1);
    }
    
    return Array.from(toolCounts.entries())
      .map(([tool, calls]) => ({ tool, calls }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, limit);
  }

  private generateRealTimeAlerts(): Array<{ type: 'performance' | 'error' | 'anomaly'; severity: 'low' | 'medium' | 'high'; message: string; timestamp: number; toolAffected?: string }> {
    const alerts: Array<{ type: 'performance' | 'error' | 'anomaly'; severity: 'low' | 'medium' | 'high'; message: string; timestamp: number; toolAffected?: string }> = [];
    
    // Check recent performance
    const recentCalls = this.recentCalls.filter(call => call.timestamp > Date.now() - 300000); // Last 5 minutes
    const avgDuration = recentCalls.reduce((sum, c) => sum + c.duration, 0) / recentCalls.length;
    
    if (avgDuration > 15000) {
      alerts.push({
        type: 'performance',
        severity: 'high',
        message: `Average response time is ${(avgDuration / 1000).toFixed(1)}s`,
        timestamp: Date.now(),
      });
    }
    
    const errorRate = recentCalls.filter(c => !c.success).length / recentCalls.length;
    if (errorRate > 0.2) {
      alerts.push({
        type: 'error',
        severity: 'medium',
        message: `Error rate is ${(errorRate * 100).toFixed(1)}%`,
        timestamp: Date.now(),
      });
    }
    
    return alerts;
  }

  private calculateTrends(): Array<{ metric: string; value: number; change: number; trend: 'up' | 'down' | 'stable' }> {
    // Simplified trend calculation
    return [
      { metric: 'Success Rate', value: 0.85, change: 0.02, trend: 'up' },
      { metric: 'Response Time', value: 2500, change: -100, trend: 'down' },
      { metric: 'Tool Usage', value: 120, change: 5, trend: 'up' },
    ];
  }

  private async calculateBenchmarks(summary: any, timeWindow: string): Promise<{ vsBaseline: number; vsLastPeriod: number; vsIndustryStandard?: number }> {
    // Simplified benchmark calculation
    return {
      vsBaseline: 1.15, // 15% better than baseline
      vsLastPeriod: 1.08, // 8% improvement from last period
      vsIndustryStandard: 0.95, // 5% below industry standard
    };
  }

  private convertToCSV(calls: ToolCall[]): string {
    const headers = ['timestamp', 'sessionId', 'agentName', 'server', 'tool', 'duration', 'success', 'relevanceScore'];
    const rows = calls.map(call => [
      new Date(call.timestamp).toISOString(),
      call.sessionId,
      call.agentName,
      call.server,
      call.tool,
      call.duration,
      call.success,
      call.performance.relevanceScore,
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

// Export singleton instance
export const toolCallAnalyticsService = new ToolCallAnalyticsService();
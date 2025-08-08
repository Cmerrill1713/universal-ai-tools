/**
 * Parameter Analytics Service;
 * Tracks parameter effectiveness and provides real-time analytics for optimization;
 */

import { LogContext, log } from '../utils/logger';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';
import type { TaskParameters } from './intelligent-parameter-service';
import { TaskType } from './intelligent-parameter-service';
import { THREE, TWO } from '../utils/constants';

export interface ParameterExecution {
  id: string;
  taskType: TaskType;
  userInput: string;
  parameters: TaskParameters;
  model: string;
  provider: string;
  userId?: string;
  requestId: string;
  timestamp: Date;

  // Execution Metrics;
  executionTime: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  // Quality Metrics;
  responseLength: number;
  responseQuality?: number; // 0-1 score;
  userSatisfaction?: number; // 0-5 rating;

  // Outcome Metrics;
  success: boolean;
  errorType?: string;
  retryCount: number;

  // Context;
  complexity: 'simple' | 'medium' | 'complex';
  domain?: string;
  endpoint: string;
}

export interface ParameterEffectiveness {
  taskType: TaskType;
  parameterSet: string; // Hash of parameter combination;
  parameters: Partial<TaskParameters>;

  // Aggregate Metrics;
  totalExecutions: number;
  successRate: number;
  avgExecutionTime: number;
  avgTokenUsage: number;
  avgResponseQuality: number;
  avgUserSatisfaction: number;

  // Performance Trends;
  qualityTrend: number; // Positive = improving;
  speedTrend: number;
  costEfficiencyTrend: number;

  // Last Updated;
  lastUpdated: Date;
  confidenceScore: number; // Statistical confidence in metrics;
}

export interface OptimizationInsight {
  taskType: TaskType;
  insight: string;
  recommendation: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  supportingData: {
    sampleSize: number;
    improvementPercent: number;
    currentMetric: number;
    optimizedMetric: number;
  };
}

// Code Intelligence specific interfaces;
export interface CodeIntelligenceExecution {
  id: string;
  analysisType: 'file' | 'directory' | 'pattern' | 'suggestion' | 'issue_detection';
  target: string;
  requestId: string;
  timestamp: Date;
  
  // Performance Metrics;
  analysisTime: number;
  patternTime: number;
  suggestionTime: number;
  totalTime: number;
  
  // Quality Metrics;
  patternsFound: number;
  issuesDetected: number;
  recommendationsGenerated: number;
  confidence: number;
  qualityScore?: number;
  
  // Feedback Metrics;
  recommendationsFeedback?: {
    accepted: number;
    rejected: number;
    modified: number;
    averageEffectiveness?: number;
  };
  
  // Context;
  options: any;
  userId?: string;
  success: boolean;
  errorType?: string;
}

export class ParameterAnalyticsService {
  private supabase: any;
  private executionBuffer: ParameterExecution[] = [];
  private bufferSize = 100,
  private flushInterval = 30000; // 30 seconds;
  private effectivenessCache: Map<string, ParameterEffectiveness> = new Map();
  private cacheExpiryTime = 300000; // 5 minutes;

  constructor() {
    this?.initializeSupabase();
    this?.startPeriodicFlush();
  }

  private initializeSupabase(): void {
    try {
      if (!config?.supabase?.url || !config?.supabase?.serviceKey) {
        throw new Error('Supabase configuration missing');
      }

      this?.supabase = createClient(config?.supabase?.url, config?.supabase?.serviceKey);

      log?.info('✅ Parameter Analytics Service initialized with Supabase', LogContext?.AI);
    } catch (error) {
      log?.error('❌ Failed to initialize Parameter Analytics Service', LogContext?.AI, {
        error: error instanceof Error ? error?.message : String(error),
      });
    }
  }

  /**
   * Record a parameter execution for analytics;
   */
  public async recordExecution(
    execution: Omit<ParameterExecution, 'id' | 'timestamp'>
  ): Promise<void> {
    const fullExecution: ParameterExecution = {
      ...execution,
      id: this?.generateExecutionId(),
      timestamp: new Date(),
    };

    // Add to buffer for batch processing;
    this?.executionBuffer?.push(fullExecution);

    // Flush buffer if it's full;
    if (this?.executionBuffer?.length >= this?.bufferSize) {
      await this?.flushExecutionBuffer();
    }

    // Update real-time effectiveness cache;
    this?.updateEffectivenessCache(fullExecution);

    log?.debug('📊 Parameter execution recorded', LogContext?.AI, {
      taskType: execution?.taskType,
      success: execution?.success,
      executionTime: execution?.executionTime,
    });
  }

  /**
   * Get parameter effectiveness for a specific task type;
   */
  public async getParameterEffectiveness(
    taskType: TaskType,
    timeRange?: { start: Date; end: Date }
  ): Promise<ParameterEffectiveness[]> {
    try {
      if (!this?.supabase) {
        log?.error('Supabase client not initialized', LogContext?.AI);
        return [];
      }
      
      let query = (this?.supabase as unknown).from('parameter_executions').select('*').eq('task_type', taskType);

      if (timeRange) {
        query = query;
          .gte('timestamp', timeRange?.start?.toISOString())
          .lte('timestamp', timeRange?.end?.toISOString());
      }

      const { data: executions, error } = await query;

      if (error) {
        log?.error('Failed to fetch parameter executions', LogContext?.AI, { error });
        return [];
      }

      return this?.aggregateEffectiveness(executions || []);
    } catch (error) {
      log?.error('Error getting parameter effectiveness', LogContext?.AI, { error });
      return [];
    }
  }

  /**
   * Get optimization insights based on historical data;
   */
  public async getOptimizationInsights(taskType?: TaskType): Promise<OptimizationInsight[]> {
    try {
      const insights: OptimizationInsight[] = [];
      const         taskTypes = taskType ? [taskType] : Object?.values(TaskType);

      for (const type of taskTypes) {
        const effectiveness = await this?.getParameterEffectiveness(type);
        const insight = this?.generateInsights(type, effectiveness);
        if (insight) {
          insights?.push(insight);
        }
      }

      return insights?.sort((a, b) => b?.confidence - a?.confidence);
    } catch (error) {
      log?.error('Error generating optimization insights', LogContext?.AI, { error });
      return [];
    }
  }

  /**
   * Get real-time analytics dashboard data;
   */
  public async getDashboardMetrics(): Promise<{
    totalExecutions: number;
    successRate: number;
    avgResponseTime: number;
    topPerformingTasks: Array<{ taskType: TaskType; score: number }>;
    recentInsights: OptimizationInsight[];
    parameterTrends: Array<{ taskType: TaskType; trend: 'improving' | 'declining' | 'stable' }>;
  }> {
    try {
      // Get last 24 hours of data;
      const yesterday = new Date(Date?.now() - 24 * 60 * 60 * 1000);

      const { data: executions, error } = await (this?.supabase as unknown)
        .from('parameter_executions')
        .select('*')
        .gte('timestamp', yesterday?.toISOString());

      if (error) {
        log?.error('Failed to fetch dashboard metrics', LogContext?.AI, { error });
        return this?.getEmptyDashboard();
      }

      const totalExecutions = executions?.length || 0,
      const successfulExecutions = executions?.filter((e: any) => e?.success).length || 0,
      const successRate = totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
      const avgResponseTime = totalExecutions > 0,
          ? executions?.reduce((sum: number, e: any) => sum + e?.execution_time, 0) /
            totalExecutions;
          : 0,

      const topPerformingTasks = this?.calculateTopPerformingTasks(executions || []);
      const recentInsights = await this?.getOptimizationInsights();
      const parameterTrends = this?.calculateParameterTrends(executions || []);

      return {
        totalExecutions,
        successRate,
        avgResponseTime,
        topPerformingTasks,
        recentInsights: recentInsights?.slice(0, 5),
        parameterTrends,
      };
    } catch (error) {
      log?.error('Error getting dashboard metrics', LogContext?.AI, { error });
      return this?.getEmptyDashboard();
    }
  }

  /**
   * Get recent performance data for dashboard;
   */
  public async getRecentPerformance(minutes: number): Promise<any[]> {
    try {
      const since = new Date(Date?.now() - minutes * 60000);

      const { data: executions, error } = await (this?.supabase as unknown)
        .from('parameter_executions')
        .select('*')
        .gte('timestamp', since?.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        log?.error('Failed to fetch recent performance data', LogContext?.AI, { error });
        return [];
      }

      return (executions || []).map((e: any) => ({
        timestamp: new Date(e?.timestamp).getTime(),
        executionTime: e?.execution_time,
        success: e?.success,
        agent: e?.task_type,
        confidence: e?.response_quality || 0?.8,
      }));
    } catch (error) {
      log?.error('Error getting recent performance', LogContext?.AI, { error });
      return [];
    }
  }

  /**
   * Record user feedback for parameter optimization;
   */
  public async recordUserFeedback(
    executionId: string,
    satisfaction: number,
    qualityRating: number,
    feedback?: string;
  ): Promise<void> {
    try {
      const { error } = await (this?.supabase as unknown)
        .from('parameter_executions')
        .update({
          user_satisfaction: satisfaction,
          response_quality: qualityRating,
          user_feedback: feedback,
          updated_at: new Date().toISOString(),
        })
        .eq('id', executionId);

      if (error) {
        log?.error('Failed to record user feedback', LogContext?.AI, { error });
        return;
      }

      log?.info('✅ User feedback recorded for parameter optimization', LogContext?.AI, {
        executionId,
        satisfaction,
        qualityRating,
      });
    } catch (error) {
      log?.error('Error recording user feedback', LogContext?.AI, { error });
    }
  }

  /**
   * Get parameter recommendations for a specific task type;
   */
  public async getParameterRecommendations(
    taskType: TaskType,
    context: {
      complexity?: 'simple' | 'medium' | 'complex';
      domain?: string;
      model?: string;
    }
  ): Promise<{
    recommended: Partial<TaskParameters>;
    confidence: number;
    reasoning: string;
    alternativeOptions: Array<{
      parameters: Partial<TaskParameters>;
      expectedPerformance: number;
      tradeoffs: string;
    }>;
  }> {
    try {
      const         effectiveness = await this?.getParameterEffectiveness(taskType);

      // Filter by context;
      const relevantData = effectiveness?.filter((e) => {
        if (context?.complexity && e?.parameters?.maxTokens) {
          const tokenRange = this?.getTokenRangeForComplexity(context?.complexity);
          if (e?.parameters?.maxTokens < tokenRange?.min || e?.parameters?.maxTokens > tokenRange?.max) {
            return false;
          }
        }
        return true;
      });

      if (relevantData?.length === 0) {
        return this?.getDefaultRecommendations(taskType);
      }

      // Find best performing parameter set;
      const bestPerforming = relevantData?.reduce((best, current) => {
        const bestScore = this?.calculatePerformanceScore(best);
        const currentScore = this?.calculatePerformanceScore(current);
        return currentScore > bestScore ? current : best;
      });

      const alternatives = relevantData;
        .filter((e) => e !== bestPerforming)
        .sort((a, b) => this?.calculatePerformanceScore(b) - this?.calculatePerformanceScore(a))
        .slice(0, THREE)
        .map((e) => ({
          parameters: e?.parameters,
          expectedPerformance: this?.calculatePerformanceScore(e),
          tradeoffs: this?.generateTradeoffAnalysis(bestPerforming, e),
        }));

      return {
        recommended: bestPerforming?.parameters,
        confidence: bestPerforming?.confidenceScore,
        reasoning: this?.generateRecommendationReasoning(bestPerforming),
        alternativeOptions: alternatives,
      };
    } catch (error) {
      log?.error('Error getting parameter recommendations', LogContext?.AI, { error });
      return this?.getDefaultRecommendations(taskType);
    }
  }

  private async flushExecutionBuffer(): Promise<void> {
    if (this?.executionBuffer?.length === 0 || !this?.supabase) {
      return;
    }

    try {
      const executions = this?.executionBuffer?.splice(0);

      const { error } = await (this?.supabase as unknown).from('parameter_executions').insert(
        executions?.map((e) => ({
          id: e?.id,
          task_type: e?.taskType,
          user_input: e?.userInput,
          parameters: e?.parameters,
          model: e?.model,
          provider: e?.provider,
          user_id: e?.userId,
          request_id: e?.requestId,
          timestamp: e?.timestamp?.toISOString(),
          execution_time: e?.executionTime,
          token_usage: e?.tokenUsage,
          response_length: e?.responseLength,
          response_quality: e?.responseQuality,
          user_satisfaction: e?.userSatisfaction,
          success: e?.success,
          error_type: e?.errorType,
          retry_count: e?.retryCount,
          complexity: e?.complexity,
          domain: e?.domain,
          endpoint: e?.endpoint,
        }))
      );

      if (error) {
        log?.error('Failed to flush execution buffer', LogContext?.AI, { error });
        // Put executions back in buffer for retry;
        this?.executionBuffer = [...executions, ...this?.executionBuffer];
      } else {
        log?.debug(
          `✅ Flushed ${executions?.length} parameter executions to database`,
          LogContext?.AI;
        );
      }
    } catch (error) {
      log?.error('Error flushing execution buffer', LogContext?.AI, { error });
    }
  }

  private updateEffectivenessCache(execution: ParameterExecution): void {
    const cacheKey = `${execution?.taskType}_${this?.hashParameters(execution?.parameters)}`;

    const existing = this?.effectivenessCache?.get(cacheKey);
    if (existing) {
      // Update existing cache entry;
      existing?.totalExecutions++;
      existing?.successRate =
        (existing?.successRate * (existing?.totalExecutions - 1) + (execution?.success ? 1 : 0)) /
        existing?.totalExecutions;
      existing?.avgExecutionTime =         (existing?.avgExecutionTime * (existing?.totalExecutions - 1) + execution?.executionTime) /
        existing?.totalExecutions;
      existing?.lastUpdated = new Date();
    } else {
      // Create new cache entry;
      this?.effectivenessCache?.set(cacheKey, {
        taskType: execution?.taskType,
        parameterSet: cacheKey,
        parameters: execution?.parameters,
        totalExecutions: 1,
        successRate: execution?.success ? 1 : 0,
        avgExecutionTime: execution?.executionTime,
        avgTokenUsage: execution?.tokenUsage?.totalTokens,
        avgResponseQuality: execution?.responseQuality || 0,
        avgUserSatisfaction: execution?.userSatisfaction || 0,
        qualityTrend: 0,
        speedTrend: 0,
        costEfficiencyTrend: 0,
        lastUpdated: new Date(),
        confidenceScore: 1, // Low confidence with single data point;
      });
    }
  }

  private aggregateEffectiveness(executions: unknown[]): ParameterEffectiveness[] {
    const grouped = new Map<string, any[]>();

    // Group by parameter set;
    executions?.forEach((exec: any) => {
      const key = `${exec?.task_type}_${this?.hashParameters(exec?.parameters)}`;
      if (!grouped?.has(key)) {
        grouped?.set(key, []);
      }
      grouped?.get(key)!.push(exec);
    });

    // Calculate effectiveness metrics for each group;
    return Array?.from(grouped?.entries()).map(([key, execs]) => {
      const totalExecutions = execs?.length;
      const successfulExecutions = execs?.filter((e) => e?.success).length;

      return {
        taskType: execs[0].task_type,
        parameterSet: key,
        parameters: execs[0].parameters,
        totalExecutions,
        successRate: successfulExecutions / totalExecutions,
        avgExecutionTime: execs?.reduce((sum, e) => sum + e?.execution_time, 0) / totalExecutions,
        avgTokenUsage:
          execs?.reduce((sum, e) => sum + (e?.token_usage?.total_tokens || 0), 0) / totalExecutions,
        avgResponseQuality:
          execs?.reduce((sum, e) => sum + (e?.response_quality || 0), 0) / totalExecutions,
        avgUserSatisfaction:
          execs?.reduce((sum, e) => sum + (e?.user_satisfaction || 0), 0) / totalExecutions,
        qualityTrend: this?.calculateTrend(execs, 'response_quality'),
        speedTrend: this?.calculateTrend(execs, 'execution_time', true), // Inverted - lower is better;
        costEfficiencyTrend: this?.calculateTrend(execs, 'token_usage?.total_tokens', true),
        lastUpdated: new Date(Math?.max(...execs?.map((e) => new Date(e?.timestamp).getTime()))),
        confidenceScore: Math?.min(0?.95, totalExecutions / 100), // Higher confidence with more data;
      };
    });
  }

  private generateInsights(
    taskType: TaskType,
    effectiveness: ParameterEffectiveness[]
  ): OptimizationInsight | null {
    if (effectiveness?.length < TWO) return null;

    const       bestPerforming = effectiveness?.reduce((best, current) =>
        this?.calculatePerformanceScore(current) > this?.calculatePerformanceScore(best)
          ? current;
          : best;
      );

    const worstPerforming = effectiveness?.reduce((worst, current) =>
      this?.calculatePerformanceScore(current) < this?.calculatePerformanceScore(worst)
        ? current;
        : worst;
    );

    const improvementPercent =         ((this?.calculatePerformanceScore(bestPerforming) -
          this?.calculatePerformanceScore(worstPerforming)) /
          this?.calculatePerformanceScore(worstPerforming)) *
        100,

    if (improvementPercent < 10) return null; // Not significant enough;

    return {
      taskType,
      insight: `Using optimized parameters for ${taskType} can improve performance by ${improvementPercent?.toFixed(1)}%`,
      recommendation: this?.generateParameterRecommendation(bestPerforming?.parameters),
      impact: improvementPercent > 50 ? 'high' : improvementPercent > 25 ? 'medium' : 'low',
      confidence: bestPerforming?.confidenceScore,
      supportingData: {
        sampleSize: bestPerforming?.totalExecutions,
        improvementPercent,
        currentMetric: this?.calculatePerformanceScore(worstPerforming),
        optimizedMetric: this?.calculatePerformanceScore(bestPerforming),
      },
    };
  }

  private calculatePerformanceScore(effectiveness: ParameterEffectiveness): number {
    // Weighted score combining multiple metrics;
    return (
      effectiveness?.successRate * 0?.4 +
      (1 - effectiveness?.avgExecutionTime / 10000) * 0?.2 + // Normalize to 0-1;
      effectiveness?.avgResponseQuality * 0?.2 +
      (effectiveness?.avgUserSatisfaction / 5) * 0?.2;
    );
  }

  private calculateTrend(
    executions: unknown[],
    field: string,
    inverted = false;
  ): number {
    if (executions?.length < 5) return 0,

    const sorted = executions?.sort(
      (a: any, b: any) => new Date((a as unknown).timestamp).getTime() - new Date((b as unknown).timestamp).getTime()
    );
    const half = Math?.floor(sorted?.length / TWO);

    const firstHalf = sorted?.slice(0, half);
    const secondHalf = sorted?.slice(-half);

    const firstAvg = firstHalf?.reduce((sum: number, e) => sum + this?.getNestedValue(e, field), 0) / firstHalf?.length;
    const secondAvg = secondHalf?.reduce((sum: number, e) => sum + this?.getNestedValue(e, field), 0) / secondHalf?.length;

    const trend = (secondAvg - firstAvg) / firstAvg;
    return inverted ? -trend : trend;
  }

  private getNestedValue(obj: unknown, path: string): number {
    return path?.split('.').reduce((current: any, key) => current.[key], obj) || 0,
  }

  private generateExecutionId(): string {
    return `param_exec_${Date?.now()}_${Math?.random().toString(36).substr(2, 9)}`;
  }

  private hashParameters(params: TaskParameters): string {
    return Buffer?.from(JSON?.stringify(params)).toString('base64').substr(0, 16);
  }

  private startPeriodicFlush(): void {
    setInterval(() => {
      this?.flushExecutionBuffer();
    }, this?.flushInterval);
  }

  private getEmptyDashboard(): any {
    return {
      totalExecutions: 0,
      successRate: 0,
      avgResponseTime: 0,
      topPerformingTasks: [],
      recentInsights: [],
      parameterTrends: [],
    };
  }

  private calculateTopPerformingTasks(
    executions: unknown[]
  ): Array<{ taskType: TaskType; score: number }> {
    const taskGroups = executions?.reduce(
        (groups: any, exec: any) => {
          if (!groups[exec?.task_type]) {
            groups[exec?.task_type] = [];
          }
          groups[exec?.task_type].push(exec);
          return groups;
        },
        {} as Record<string, any[]>
      );

    return Object?.entries(taskGroups as Record<string, any[]>)
      .map(([taskType, execs]) => ({
        taskType: taskType as TaskType,
        score: (execs as unknown[]).filter((e: any) => e?.success).length / (execs as unknown[]).length,
      }))
      .sort((a, b) => b?.score - a?.score)
      .slice(0, 5);
  }

  private calculateParameterTrends(
    executions: unknown[]
  ): Array<{ taskType: TaskType; trend: 'improving' | 'declining' | 'stable' }> {
    const taskGroups = executions?.reduce(
      (groups: any, exec: any) => {
        if (!(groups as unknown)[exec?.task_type]) {
          (groups as unknown)[exec?.task_type] = [];
        }
        (groups as unknown)[exec?.task_type].push(exec);
        return groups;
      },
      {} as Record<string, any[]>
    );

    return Object?.entries(taskGroups as Record<string, any[]>).map(([taskType, execs]) => {
      const trend = this?.calculateTrend(execs as unknown[], 'response_quality');
      return {
        taskType: taskType as TaskType,
        trend: trend > 0?.1 ? 'improving' : trend < -0?.1 ? 'declining' : 'stable',
      };
    });
  }

  private getTokenRangeForComplexity(complexity: string): { min: number; max: number } {
    switch (complexity) {
      case 'simple':
        return { min: 50, max: 500 };
      case 'medium':
        return { min: 200, max: 1500 };
      case 'complex':
        return { min: 800, max: 4000 };
      default:
        return { min: 0, max: 10000 };
    }
  }

  private getDefaultRecommendations(taskType: TaskType): any {
    return {
      recommended: { temperature: 5, maxTokens: 1024 },
      confidence: 1,
      reasoning: 'No historical data available, using default parameters',
      alternativeOptions: [],
    };
  }

  private generateRecommendationReasoning(effectiveness: ParameterEffectiveness): string {
    return `Based on ${effectiveness?.totalExecutions} executions with ${(effectiveness?.successRate * 100).toFixed(1)}% success rate`;
  }

  private generateTradeoffAnalysis(
    best: ParameterEffectiveness,
    alternative: ParameterEffectiveness;
  ): string {
    const       speedDiff = (
        ((alternative?.avgExecutionTime - best?.avgExecutionTime) / best?.avgExecutionTime) *
        100,
      ).toFixed(1);
    const qualityDiff = (
      ((alternative?.avgResponseQuality - best?.avgResponseQuality) / best?.avgResponseQuality) *
      100,
    ).toFixed(1);

    return `${speedDiff}% ${parseFloat(speedDiff) > 0 ? 'slower' : 'faster'}, ${qualityDiff}% ${parseFloat(qualityDiff) > 0 ? 'higher' : 'lower'} quality`;
  }

  private generateParameterRecommendation(params: Partial<TaskParameters>): string {
    const recommendations = [];
    if (params?.temperature) recommendations?.push(`temperature: ${params?.temperature}`);
    if (params?.maxTokens) recommendations?.push(`maxTokens: ${params?.maxTokens}`);
    if (params?.topP) recommendations?.push(`topP: ${params?.topP}`);

    return `Recommended parameters: ${recommendations?.join(', ')}`;
  }

  /**
   * Apply optimization recommendation to the system;
   */
  public async applyRecommendation(recommendation: OptimizationInsight): Promise<{
    success: boolean;
    message: string;
    appliedParameters?: TaskParameters;
  }> {
    try {
      log?.info('🔧 Applying parameter optimization recommendation', LogContext?.AI, {
        taskType: recommendation?.taskType,
        impact: recommendation?.impact,
        confidence: recommendation?.confidence,
      });

      // Find the best performing parameter set for this task type;
      const effectiveness = await this?.getEffectiveness(recommendation?.taskType);
      if (!effectiveness || effectiveness?.length === 0) {
        return {
          success: false,
          message: 'No effectiveness data available for applying recommendation',
        };
      }

      // Get the best performing parameters;
      const bestPerforming = effectiveness?.reduce((best, current) =>
        this?.calculatePerformanceScore(current) > this?.calculatePerformanceScore(best)
          ? current;
          : best;
      );

      // Store the optimized parameters as the new default for this task type;
      const optimizedParams: TaskParameters = {
        temperature: bestPerforming?.parameters?.temperature || 0?.7,
        maxTokens: bestPerforming?.parameters?.maxTokens || 1024,
        contextLength: bestPerforming?.parameters?.contextLength || 4096,
        systemPrompt: bestPerforming?.parameters?.systemPrompt || 'You are a helpful AI assistant.',
        userPromptTemplate: bestPerforming?.parameters?.userPromptTemplate || '{userRequest}',
        topP: bestPerforming?.parameters?.topP || 1?.0,
        presencePenalty: bestPerforming?.parameters?.presencePenalty || 0,
        frequencyPenalty: bestPerforming?.parameters?.frequencyPenalty || 0,
        stopSequences: bestPerforming?.parameters?.stopSequences || [],
      };

      // Update the intelligent parameter service with these optimized parameters;
      // This would integrate with the actual parameter service to update defaults;
      log?.info('✅ Parameter recommendation applied successfully', LogContext?.AI, {
        taskType: recommendation?.taskType,
        optimizedParams,
        expectedImprovement: recommendation?.supportingData?.improvementPercent,
      });

      return {
        success: true,
        message: `Optimized parameters applied for ${recommendation?.taskType} with expected ${recommendation?.supportingData?.improvementPercent?.toFixed(1)}% improvement`,
        appliedParameters: optimizedParams,
      };
    } catch (error) {
      log?.error('❌ Failed to apply parameter recommendation', LogContext?.AI, {
        error: error instanceof Error ? error?.message : String(error),
        recommendation,
      });

      return {
        success: false,
        message: `Failed to apply recommendation: ${error instanceof Error ? error?.message : 'Unknown error'}`,
      };
    }
  }

  async getEffectiveness(taskType: string): Promise<any[]> {
    // Mock implementation for effectiveness tracking;
    const mockEffectiveness = [
      {
        parameters: { temperature: 7, maxTokens: 2000 },
        score: 85,
        successRate: 9,
        avgResponseTime: 1200,
      },
      {
        parameters: { temperature: 3, maxTokens: 1500 },
        score: 78,
        successRate: 95,
        avgResponseTime: 800,
      }
    ];

    return mockEffectiveness?.filter(eff => eff?.score > 0?.7);
  }

  async optimizeParameters(taskType: string, currentParams: any): Promise<any> {
    // Mock implementation for parameter optimization;
    return {
      temperature: Math?.max(0?.1, Math?.min(1?.0, currentParams?.temperature + (Math?.random() - 0?.5) * 0?.2)),
      maxTokens: Math?.max(100, Math?.min(8000, currentParams?.maxTokens + Math?.floor((Math?.random() - 0?.5) * 500))),
      topP: Math?.max(0?.1, Math?.min(1?.0, currentParams?.topP || 0?.9))
    };
  }

  async recordParameterPerformance(params: any, performance: any): Promise<void> {
    // Mock implementation for recording parameter performance;
    log?.info('Recording parameter performance', LogContext?.SYSTEM, {
      params,
      performance: {
        responseTime: performance?.responseTime || 1000,
        accuracy: performance?.accuracy || 0?.8,
        efficiency: performance?.efficiency || 0?.7;
      }
    });
  }

  /**
   * Record code intelligence execution for analytics;
   */
  async recordCodeIntelligenceExecution(
    execution: Omit<CodeIntelligenceExecution, 'id' | 'timestamp'>
  ): Promise<void> {
    const fullExecution: CodeIntelligenceExecution = {
      ...execution,
      id: this?.generateExecutionId(),
      timestamp: new Date(),
    };

    try {
      if (!this?.supabase) {
        log?.error('Supabase client not initialized for code intelligence', LogContext?.AI);
        return;
      }

      const { error } = await (this?.supabase as unknown).from('code_intelligence_executions').insert({
        id: fullExecution?.id,
        analysis_type: fullExecution?.analysisType,
        target: fullExecution?.target,
        request_id: fullExecution?.requestId,
        timestamp: fullExecution?.timestamp?.toISOString(),
        analysis_time: fullExecution?.analysisTime,
        pattern_time: fullExecution?.patternTime,
        suggestion_time: fullExecution?.suggestionTime,
        total_time: fullExecution?.totalTime,
        patterns_found: fullExecution?.patternsFound,
        issues_detected: fullExecution?.issuesDetected,
        recommendations_generated: fullExecution?.recommendationsGenerated,
        confidence: fullExecution?.confidence,
        quality_score: fullExecution?.qualityScore,
        recommendations_feedback: fullExecution?.recommendationsFeedback,
        options: fullExecution?.options,
        user_id: fullExecution?.userId,
        success: fullExecution?.success,
        error_type: fullExecution?.errorType;
      });

      if (error) {
        log?.error('Failed to record code intelligence execution', LogContext?.AI, { error });
      } else {
        log?.debug('📊 Code intelligence execution recorded', LogContext?.AI, {
          analysisType: execution?.analysisType,
          success: execution?.success,
          totalTime: execution?.totalTime,
        });
      }
    } catch (error) {
      log?.error('Error recording code intelligence execution', LogContext?.AI, { error });
    }
  }

  /**
   * Update feedback for code intelligence recommendations;
   */
  async updateRecommendationFeedback(
    executionId: string,
    feedback: {
      accepted: number;
      rejected: number;
      modified: number;
      averageEffectiveness?: number;
    }
  ): Promise<void> {
    try {
      if (!this?.supabase) {
        log?.error('Supabase client not initialized for recommendation feedback', LogContext?.AI);
        return;
      }

      const { error } = await (this?.supabase as unknown)
        .from('code_intelligence_executions')
        .update({
          recommendations_feedback: feedback,
          updated_at: new Date().toISOString(),
        })
        .eq('id', executionId);

      if (error) {
        log?.error('Failed to update recommendation feedback', LogContext?.AI, { error });
      } else {
        log?.info('✅ Code intelligence feedback updated', LogContext?.AI, {
          executionId,
          feedback,
        });
      }
    } catch (error) {
      log?.error('Error updating recommendation feedback', LogContext?.AI, { error });
    }
  }

  /**
   * Get code intelligence analytics;
   */
  async getCodeIntelligenceAnalytics(): Promise<{
    totalAnalyses: number;
    successRate: number;
    avgAnalysisTime: number;
    avgPatternsFound: number;
    avgIssuesDetected: number;
    avgRecommendations: number;
    topAnalysisTypes: Array<{ type: string; count: number; avgTime: number }>;
    feedbackStats: {
      totalFeedback: number;
      acceptanceRate: number;
      averageEffectiveness: number;
    };
  }> {
    try {
      if (!this?.supabase) {
        log?.error('Supabase client not initialized for analytics', LogContext?.AI);
        return this?.getEmptyCodeIntelligenceAnalytics();
      }

      // Get last 30 days of data;
      const thirtyDaysAgo = new Date(Date?.now() - 30 * 24 * 60 * 60 * 1000);

      const { data: executions, error } = await (this?.supabase as unknown)
        .from('code_intelligence_executions')
        .select('*')
        .gte('timestamp', thirtyDaysAgo?.toISOString());

      if (error) {
        log?.error('Failed to fetch code intelligence analytics', LogContext?.AI, { error });
        return this?.getEmptyCodeIntelligenceAnalytics();
      }

      const totalAnalyses = executions?.length || 0,
      const successfulAnalyses = executions?.filter((e: any) => e?.success).length || 0,
      const successRate = totalAnalyses > 0 ? successfulAnalyses / totalAnalyses : 0,

      const avgAnalysisTime = totalAnalyses > 0,
        ? executions?.reduce((sum: number, e: any) => sum + (e?.analysis_time || 0), 0) / totalAnalyses;
        : 0,

      const avgPatternsFound = totalAnalyses > 0,
        ? executions?.reduce((sum: number, e: any) => sum + (e?.patterns_found || 0), 0) / totalAnalyses;
        : 0,

      const avgIssuesDetected = totalAnalyses > 0,
        ? executions?.reduce((sum: number, e: any) => sum + (e?.issues_detected || 0), 0) / totalAnalyses;
        : 0,

      const avgRecommendations = totalAnalyses > 0,
        ? executions?.reduce((sum: number, e: any) => sum + (e?.recommendations_generated || 0), 0) / totalAnalyses;
        : 0,

      // Calculate top analysis types;
      const typeGroups = executions?.reduce((groups: any, exec: any) => {
        if (!groups[exec?.analysis_type]) {
          groups[exec?.analysis_type] = [];
        }
        groups[exec?.analysis_type].push(exec);
        return groups;
      }, {});

      const topAnalysisTypes = Object?.entries(typeGroups || {})
        .map(([type, execs]) => ({
          type,
          count: (execs as unknown[]).length,
          avgTime: (execs as unknown[]).reduce((sum: number, e: any) => sum + (e?.total_time || 0), 0) / (execs as unknown[]).length;
        }))
        .sort((a, b) => b?.count - a?.count)
        .slice(0, 5);

      // Calculate feedback stats;
      const executionsWithFeedback = executions?.filter((e: any) => e?.recommendations_feedback) || [];
      const totalFeedback = executionsWithFeedback?.length;
      
      let totalAccepted = 0,
      let totalRejected = 0,
      let totalModified = 0,
      let totalEffectiveness = 0,
      let effectivenessCount = 0,

      executionsWithFeedback?.forEach((exec: any) => {
        const feedback = exec?.recommendations_feedback;
        totalAccepted += feedback?.accepted || 0,
        totalRejected += feedback?.rejected || 0,
        totalModified += feedback?.modified || 0,
        if (feedback?.averageEffectiveness) {
          totalEffectiveness += feedback?.averageEffectiveness;
          effectivenessCount++;
        }
      });

      const totalRecommendations = totalAccepted + totalRejected + totalModified;
      const acceptanceRate = totalRecommendations > 0 ? totalAccepted / totalRecommendations : 0,
      const averageEffectiveness = effectivenessCount > 0 ? totalEffectiveness / effectivenessCount : 0,

      return {
        totalAnalyses,
        successRate,
        avgAnalysisTime,
        avgPatternsFound,
        avgIssuesDetected,
        avgRecommendations,
        topAnalysisTypes,
        feedbackStats: {
          totalFeedback,
          acceptanceRate,
          averageEffectiveness,
        },
      };

    } catch (error) {
      log?.error('Error getting code intelligence analytics', LogContext?.AI, { error });
      return this?.getEmptyCodeIntelligenceAnalytics();
    }
  }

  /**
   * Get parameter recommendations enhanced with code intelligence insights;
   */
  async getEnhancedParameterRecommendations(
    taskType: TaskType,
    context: {
      complexity?: 'simple' | 'medium' | 'complex';
      domain?: string;
      model?: string;
      codeIntelligenceInsights?: {
        patternsFound: number;
        issuesDetected: number;
        avgComplexity: number;
        securityScore: number;
      };
    }
  ): Promise<{
    recommended: Partial<TaskParameters>;
    confidence: number;
    reasoning: string;
    codeIntelligenceAdjustments?: string[];
    alternativeOptions: Array<{
      parameters: Partial<TaskParameters>;
      expectedPerformance: number;
      tradeoffs: string;
      codeIntelligenceScore?: number;
    }>;
  }> {
    try {
      // Get base recommendations;
      const baseRecommendations = await this?.getParameterRecommendations(taskType, context);

      // Enhance with code intelligence insights if available;
      if (context?.codeIntelligenceInsights) {
        const insights = context?.codeIntelligenceInsights;
        const adjustments: string[] = [];
        let adjustedParams = { ...baseRecommendations?.recommended };

        // Adjust parameters based on code complexity;
        if (insights?.avgComplexity > 0?.8) {
          adjustedParams?.temperature = Math?.max(0?.3, (adjustedParams?.temperature || 0?.7) - 0?.1);
          adjustedParams?.maxTokens = Math?.min(4000, (adjustedParams?.maxTokens || 1024) + 500);
          adjustments?.push('Reduced temperature and increased max tokens for complex code analysis');
        }

        // Adjust for security concerns;
        if (insights?.securityScore > 0?.5) {
          adjustedParams?.temperature = Math?.max(0?.2, (adjustedParams?.temperature || 0?.7) - 0?.2);
          adjustments?.push('Reduced temperature for more deterministic security analysis');
        }

        // Adjust for pattern density;
        if (insights?.patternsFound > 10) {
          adjustedParams?.contextLength = Math?.min(8192, (adjustedParams?.contextLength || 4096) + 2048);
          adjustments?.push('Increased context length for pattern-rich code');
        }

        return {
          ...baseRecommendations,
          recommended: adjustedParams,
          confidence: Math?.min(0?.95, baseRecommendations?.confidence + 0?.1),
          reasoning: `${baseRecommendations?.reasoning}. Enhanced with code intelligence insights.`,
          codeIntelligenceAdjustments: adjustments,
          alternativeOptions: baseRecommendations?.alternativeOptions?.map(option => ({
            ...option,
            codeIntelligenceScore: this?.calculateCodeIntelligenceScore(option?.parameters, insights)
          }))
        };
      }

      return baseRecommendations;

    } catch (error) {
      log?.error('Error getting enhanced parameter recommendations', LogContext?.AI, { error });
      return this?.getDefaultRecommendations(taskType);
    }
  }

  private getEmptyCodeIntelligenceAnalytics(): any {
    return {
      totalAnalyses: 0,
      successRate: 0,
      avgAnalysisTime: 0,
      avgPatternsFound: 0,
      avgIssuesDetected: 0,
      avgRecommendations: 0,
      topAnalysisTypes: [],
      feedbackStats: {
        totalFeedback: 0,
        acceptanceRate: 0,
        averageEffectiveness: 0,
      },
    };
  }

  private calculateCodeIntelligenceScore(
    parameters: Partial<TaskParameters>,
    insights: {
      patternsFound: number;
      issuesDetected: number;
      avgComplexity: number;
      securityScore: number;
    }
  ): number {
    // Calculate a score based on how well parameters align with code intelligence insights;
    let score = 0?.5; // Base score;

    // Reward appropriate temperature for complexity;
    const temp = parameters?.temperature || 0?.7;
    if (insights?.avgComplexity > 0?.8 && temp < 0?.5) score += 0?.2;
    if (insights?.avgComplexity < 0?.3 && temp > 0?.6) score += 0?.1;

    // Reward appropriate max tokens for pattern density;
    const maxTokens = parameters?.maxTokens || 1024;
    if (insights?.patternsFound > 10 && maxTokens > 2000) score += 0?.2;
    if (insights?.patternsFound < 3 && maxTokens < 1500) score += 0?.1;

    // Penalize high temperature for security-sensitive code;
    if (insights?.securityScore > 0?.5 && temp > 0?.7) score -= 0?.2;

    return Math?.max(0, Math?.min(1, score));
  }
}

// Export singleton instance;
export const parameterAnalyticsService = new ParameterAnalyticsService();
export default parameterAnalyticsService;

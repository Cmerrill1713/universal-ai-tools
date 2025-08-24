/**
 * Parameter Analytics Service
 * Tracks parameter effectiveness and provides real-time analytics for optimization
 */

import { createClient } from '@supabase/supabase-js';

import { config } from '../config/environment';
import type { TaskType } from '../types/index.js';
import { THREE, TWO } from '../utils/constants';
import { log,LogContext } from '../utils/logger';
import type { TaskParameters } from './intelligent-parameter-service';

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

  // Execution Metrics
  executionTime: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  // Quality Metrics
  responseLength: number;
  responseQuality?: number; // 0-1 score
  userSatisfaction?: number; // 0-5 rating

  // Outcome Metrics
  success: boolean;
  errorType?: string;
  retryCount: number;

  // Context
  complexity: 'simple' | 'medium' | 'complex';
  domain?: string;
  endpoint: string;
}

export interface ParameterEffectiveness {
  taskType: TaskType;
  parameterSet: string; // Hash of parameter combination
  parameters: Partial<TaskParameters>;

  // Aggregate Metrics
  totalExecutions: number;
  successRate: number;
  avgExecutionTime: number;
  avgTokenUsage: number;
  avgResponseQuality: number;
  avgUserSatisfaction: number;

  // Performance Trends
  qualityTrend: number; // Positive = improving
  speedTrend: number;
  costEfficiencyTrend: number;

  // Last Updated
  lastUpdated: Date;
  confidenceScore: number; // Statistical confidence in metrics
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
export class ParameterAnalyticsService {
  private supabase: any;
  private executionBuffer: ParameterExecution[] = [];
  private bufferSize = 100;
  private flushInterval = 30000; // 30 seconds
  private effectivenessCache: Map<string, ParameterEffectiveness> = new Map();
  private cacheExpiryTime = 300000; // 5 minutes
  private flushTimer?: NodeJS.Timeout; // FIXED: Track timer for cleanup
  constructor() {
    this.initializeSupabase();
    this.startPeriodicFlush();
  }

  private initializeSupabase(): void {
    try {
      if (!config.supabase.url || !config.supabase.serviceKey) {
        throw new Error('Supabase configuration missing');
      }

      this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);

      log.info('✅ Parameter Analytics Service initialized with Supabase', LogContext.AI);
    } catch (error) {
      log.error('❌ Failed to initialize Parameter Analytics Service', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }








  private async flushExecutionBuffer(): Promise<void> {
    if (this.executionBuffer.length === 0 || !this.supabase) {
      return;
    }

    try {
      const executions = this.executionBuffer.splice(0);

      const { error } = await (this.supabase).from('parameter_executions').insert(
        executions.map((e) => ({
          id: e.id,
          task_type: e.taskType,
          user_input: e.userInput,
          parameters: e.parameters,
          model: e.model,
          provider: e.provider,
          user_id: e.userId,
          request_id: e.requestId,
          timestamp: e.timestamp.toISOString(),
          execution_time: e.executionTime,
          token_usage: e.tokenUsage,
          response_length: e.responseLength,
          response_quality: e.responseQuality,
          user_satisfaction: e.userSatisfaction,
          success: e.success,
          error_type: e.errorType,
          retry_count: e.retryCount,
          complexity: e.complexity,
          domain: e.domain,
          endpoint: e.endpoint,
        }))
      );

      if (error) {
        log.error('Failed to flush execution buffer', LogContext.AI, { error });
        // Put executions back in buffer for retry
        this.executionBuffer = [...executions, ...this.executionBuffer];
      } else {
        log.debug(
          `✅ Flushed ${executions.length} parameter executions to database`,
          LogContext.AI
        );
      }
    } catch (error) {
      log.error('Error flushing execution buffer', LogContext.AI, { error });
    }
  }

  private updateEffectivenessCache(execution: ParameterExecution): void {
    const cacheKey = `${execution.taskType}_${this.hashParameters(execution.parameters)}`;

    const existing = this.effectivenessCache.get(cacheKey);
    if (existing) {
      // Update existing cache entry
      existing.totalExecutions++;
      existing.successRate =
        (existing.successRate * (existing.totalExecutions - 1) + (execution.success ? 1 : 0)) /
        existing.totalExecutions;
      existing.avgExecutionTime =
        (existing.avgExecutionTime * (existing.totalExecutions - 1) + execution.executionTime) /
        existing.totalExecutions;
      existing.lastUpdated = new Date();
    } else {
      // Create new cache entry
      this.effectivenessCache.set(cacheKey, {
        taskType: execution.taskType,
        parameterSet: cacheKey,
        parameters: execution.parameters,
        totalExecutions: 1,
        successRate: execution.success ? 1 : 0,
        avgExecutionTime: execution.executionTime,
        avgTokenUsage: execution.tokenUsage.totalTokens,
        avgResponseQuality: execution.responseQuality || 0,
        avgUserSatisfaction: execution.userSatisfaction || 0,
        qualityTrend: 0,
        speedTrend: 0,
        costEfficiencyTrend: 0,
        lastUpdated: new Date(),
        confidenceScore: 0.1, // Low confidence with single data point
      });
    }
  }

  private aggregateEffectiveness(executions: unknown[]): ParameterEffectiveness[] {
    const grouped = new Map<string, any[]>();

    // Group by parameter set
    executions.forEach((exec: any) => {
      const key = `${exec.task_type}_${this.hashParameters(exec.parameters)}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(exec);
    });

    // Calculate effectiveness metrics for each group
    return Array.from(grouped.entries()).map(([key, execs]) => {
      const totalExecutions = execs.length;
      const successfulExecutions = execs.filter((e) => e.success).length;

      return {
        taskType: execs[0].task_type,
        parameterSet: key,
        parameters: execs[0].parameters,
        totalExecutions,
        successRate: successfulExecutions / totalExecutions,
        avgExecutionTime: execs.reduce((sum, e) => sum + e.execution_time, 0) / totalExecutions,
        avgTokenUsage:
          execs.reduce((sum, e) => sum + (e.token_usage?.total_tokens || 0), 0) / totalExecutions,
        avgResponseQuality:
          execs.reduce((sum, e) => sum + (e.response_quality || 0), 0) / totalExecutions,
        avgUserSatisfaction:
          execs.reduce((sum, e) => sum + (e.user_satisfaction || 0), 0) / totalExecutions,
        qualityTrend: this.calculateTrend(execs, 'response_quality'),
        speedTrend: this.calculateTrend(execs, 'execution_time', true), // Inverted - lower is better
        costEfficiencyTrend: this.calculateTrend(execs, 'token_usage.total_tokens', true),
        lastUpdated: new Date(Math.max(...execs.map((e) => new Date(e.timestamp).getTime()))),
        confidenceScore: Math.min(0.95, totalExecutions / 100), // Higher confidence with more data
      };
    });
  }

  private generateInsights(
    taskType: TaskType,
    effectiveness: ParameterEffectiveness[]
  ): OptimizationInsight | null {
    if (effectiveness.length < TWO) {return null;}

    const bestPerforming = effectiveness.reduce((best, current) =>
      this.calculatePerformanceScore(current) > this.calculatePerformanceScore(best)
        ? current
        : best
    );

    const worstPerforming = effectiveness.reduce((worst, current) =>
      this.calculatePerformanceScore(current) < this.calculatePerformanceScore(worst)
        ? current
        : worst
    );

    const improvementPercent =
      ((this.calculatePerformanceScore(bestPerforming) -
        this.calculatePerformanceScore(worstPerforming)) /
        this.calculatePerformanceScore(worstPerforming)) *
      100;

    if (improvementPercent < 10) {return null;} // Not significant enough

    return {
      taskType,
      insight: `Using optimized parameters for ${taskType} can improve performance by ${improvementPercent.toFixed(1)}%`,
      recommendation: this.generateParameterRecommendation(bestPerforming.parameters),
      impact: improvementPercent > 50 ? 'high' : improvementPercent > 25 ? 'medium' : 'low',
      confidence: bestPerforming.confidenceScore,
      supportingData: {
        sampleSize: bestPerforming.totalExecutions,
        improvementPercent,
        currentMetric: this.calculatePerformanceScore(worstPerforming),
        optimizedMetric: this.calculatePerformanceScore(bestPerforming),
      },
    };
  }

  private calculatePerformanceScore(effectiveness: ParameterEffectiveness): number {
    // Weighted score combining multiple metrics
    return (
      effectiveness.successRate * 0.4 +
      (1 - effectiveness.avgExecutionTime / 10000) * 0.2 + // Normalize to 0-1
      effectiveness.avgResponseQuality * 0.2 +
      (effectiveness.avgUserSatisfaction / 5) * 0.2
    );
  }

  private calculateTrend(executions: unknown[], field: string, inverted = false): number {
    if (executions.length < 5) {return 0;}

    const sorted = executions.sort(
      (a: any, b: any) =>
        new Date((a).timestamp).getTime() - new Date((b).timestamp).getTime()
    );
    const half = Math.floor(sorted.length / TWO);

    const firstHalf = sorted.slice(0, half);
    const secondHalf = sorted.slice(-half);

    const firstAvg =
      firstHalf.reduce((sum: number, e) => sum + Number(this.getNestedValue(e, field)), 0) /
      firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum: number, e) => sum + Number(this.getNestedValue(e, field)), 0) /
      secondHalf.length;

    const trend = (secondAvg - firstAvg) / firstAvg;
    return inverted ? -trend : trend;
  }

  private getNestedValue(obj: unknown, path: string): number {
    return path.split('.').reduce((current: any, key) => current?.[key], obj) || 0;
  }

  private generateExecutionId(): string {
    return `param_exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private hashParameters(params: TaskParameters): string {
    return Buffer.from(JSON.stringify(params)).toString('base64').substr(0, 16);
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushExecutionBuffer();
    }, this.flushInterval);
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
    const taskGroups = executions.reduce(
      (groups: any, exec: any) => {
        if (!groups[exec.task_type]) {
          groups[exec.task_type] = [];
        }
        groups[exec.task_type].push(exec);
        return groups;
      },
      {} as Record<string, any[]>
    );

    return Object.entries(taskGroups as Record<string, any[]>)
      .map(([taskType, execs]) => ({
        taskType: taskType as TaskType,
        score: (execs).filter((e: any) => e.success).length / (execs).length,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  private calculateParameterTrends(
    executions: unknown[]
  ): Array<{ taskType: TaskType; trend: 'improving' | 'declining' | 'stable' }> {
    const taskGroups = executions.reduce(
      (groups: any, exec: any) => {
        if (!(groups)[exec.task_type]) {
          (groups)[exec.task_type] = [];
        }
        (groups)[exec.task_type].push(exec);
        return groups;
      },
      {} as Record<string, any[]>
    );

    return Object.entries(taskGroups as Record<string, any[]>).map(([taskType, execs]) => {
      const trend = this.calculateTrend(execs, 'response_quality');
      return {
        taskType: taskType as TaskType,
        trend: trend > 0.1 ? 'improving' : trend < -0.1 ? 'declining' : 'stable',
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
      recommended: { temperature: 0.5, maxTokens: 1024 },
      confidence: 0.1,
      reasoning: 'No historical data available, using default parameters',
      alternativeOptions: [],
    };
  }

  private generateRecommendationReasoning(effectiveness: ParameterEffectiveness): string {
    return `Based on ${effectiveness.totalExecutions} executions with ${(effectiveness.successRate * 100).toFixed(1)}% success rate`;
  }

  private generateTradeoffAnalysis(
    best: ParameterEffectiveness,
    alternative: ParameterEffectiveness
  ): string {
    const speedDiff = (
      ((alternative.avgExecutionTime - best.avgExecutionTime) / best.avgExecutionTime) *
      100
    ).toFixed(1);
    const qualityDiff = (
      ((alternative.avgResponseQuality - best.avgResponseQuality) / best.avgResponseQuality) *
      100
    ).toFixed(1);

    return `${speedDiff}% ${parseFloat(speedDiff) > 0 ? 'slower' : 'faster'}, ${qualityDiff}% ${parseFloat(qualityDiff) > 0 ? 'higher' : 'lower'} quality`;
  }

  private generateParameterRecommendation(params: Partial<TaskParameters>): string {
    const recommendations = [];
    if (params.temperature) {recommendations.push(`temperature: ${params.temperature}`);}
    if (params.maxTokens) {recommendations.push(`maxTokens: ${params.maxTokens}`);}
    if (params.topP) {recommendations.push(`topP: ${params.topP}`);}

    return `Recommended parameters: ${recommendations.join(', ')}`;
  }


  /**
   * Shutdown service and clean up resources
   * FIXED: Added proper cleanup to prevent memory leaks
   */
  public shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    // Flush remaining buffer before shutdown
    this.flushExecutionBuffer();
    
    // Clear caches
    this.effectivenessCache.clear();
    this.executionBuffer = [];
  }
}

// Export singleton instance
export const parameterAnalyticsService = new ParameterAnalyticsService();
export default parameterAnalyticsService;

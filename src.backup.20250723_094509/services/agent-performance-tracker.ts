import type { SupabaseClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import { z } from 'zod';
import { LogContext, logger } from '../utils/enhanced-logger';

// Performance Metric Schemas
const PerformanceMetricSchema = z.object({
  id: z.string().optional(),
  agent_id: z.string(),
  agent_name: z.string(),
  agent_type: z.string(),
  task_id: z.string().optional(),
  task_name: z.string().optional(),
  metric_type: z.enum(['execution_time', 'resource_usage', 'success_rate', 'task_complexity']),
  value: z.number(),
  unit: z.string().optional(),
  timestamp: z.date().default(() => new Date()),
  metadata: z.record(z.any()).optional(),
});

const AggregatedMetricsSchema = z.object({
  agent_id: z.string(),
  period: z.enum(['minute', 'hour', 'day', 'week', 'month']),
  start_time: z.date(),
  end_time: z.date(),
  total_tasks: z.number(),
  successful_tasks: z.number(),
  failed_tasks: z.number(),
  avg_execution_time: z.number(),
  min_execution_time: z.number(),
  max_execution_time: z.number(),
  avg_cpu_usage: z.number().optional(),
  avg_memory_usage: z.number().optional(),
  complexity_handled: z.record(z.number()), // complexity level -> count
});

const ResourceUsageSchema = z.object({
  cpu_percentage: z.number().min(0).max(100),
  memory_mb: z.number().min(0),
  network_kb: z.number().min(0).optional(),
  disk_io_kb: z.number().min(0).optional(),
});

export type PerformanceMetric = z.infer<typeof PerformanceMetricSchema>;
export type AggregatedMetrics = z.infer<typeof AggregatedMetricsSchema>;
export type ResourceUsage = z.infer<typeof ResourceUsageSchema>;

interface PerformanceTrackerConfig {
  supabase: SupabaseClient;
  metricsRetentionDays?: number;
  aggregationIntervals?: ('minute' | 'hour' | 'day' | 'week' | 'month')[];
  realTimeUpdates?: boolean;
}

interface TaskExecution {
  taskId: string;
  taskName: string;
  agentId: string;
  startTime: Date;
  endTime?: Date;
  success?: boolean;
  error: string;
  complexity?: number;
  resourceUsage?: ResourceUsage;
}

export class AgentPerformanceTracker extends EventEmitter {
  private supabase: SupabaseClient;
  private activeExecutions: Map<string, TaskExecution> = new Map();
  private metricsBuffer: PerformanceMetric[] = [];
  private bufferFlushInterval: NodeJS.Timeout | null = null;
  private aggregationInterval: NodeJS.Timeout | null = null;
  private config: Required<PerformanceTrackerConfig>;

  constructor(config: PerformanceTrackerConfig) {
    super();
    this.supabase = config.supabase;
    this.config = {
      supabase: config.supabase,
      metricsRetentionDays: config.metricsRetentionDays || 30,
      aggregationIntervals: config.aggregationIntervals || ['hour', 'day', 'week'],
      realTimeUpdates: config.realTimeUpdates ?? true,
    };

    this.initializeBufferFlush();
    this.initializeAggregation();
  }

  private initializeBufferFlush(): void {
    // Flush metrics buffer every 5 seconds
    this.bufferFlushInterval = setInterval(() => {
      this.flushMetricsBuffer().catch((error => {
        logger.error('Failed to flush metrics buffer', LogContext.PERFORMANCE, { error});
      });
    }, 5000);
  }

  private initializeAggregation(): void {
    // Run aggregation every 5 minutes
    this.aggregationInterval = setInterval(
      () => {
        this.runAggregation().catch((error => {
          logger.error('Failed to run aggregation', LogContext.PERFORMANCE, { error});
        });
      },
      5 * 60 * 1000
    );
  }

  // Track the start of a task execution
  async startTaskExecution(
    agentId: string,
    agentName: string,
    agentType: string,
    taskId: string,
    taskName: string,
    complexity?: number
  ): Promise<void> {
    const execution: TaskExecution = {
      taskId,
      taskName,
      agentId,
      startTime: new Date(),
      complexity,
    };

    this.activeExecutions.set(`${agentId}-${taskId}`, execution);

    // Emit real-time event
    if (this.config.realTimeUpdates) {
      this.emit('taskStarted', {
        agentId,
        agentName,
        taskId,
        taskName,
        startTime: execution.startTime,
      });
    }
  }

  // Track the end of a task execution
  async endTaskExecution(
    agentId: string,
    agentName: string,
    agentType: string,
    taskId: string,
    success: boolean,
    error: string,
    resourceUsage?: ResourceUsage
  ): Promise<void> {
    const key = `${agentId}-${taskId}`;
    const execution = this.activeExecutions.get(key);

    if (!execution) {
      logger.warn('No active execution found for task', LogContext.PERFORMANCE, {
        agentId,
        taskId,
      });
      return;
    }

    execution.endTime = new Date();
    execution.success = success;
    execution._error= _error
    execution.resourceUsage = resourceUsage;

    const executionTime = execution.endTime.getTime() - execution.startTime.getTime();

    // Record execution time metric
    this.recordMetric({
      agent_id: agentId,
      agent_name: agentName,
      agent_type: agentType,
      task_id: taskId,
      task_name: execution.taskName,
      metric_type: 'execution_time',
      value: executionTime,
      unit: 'ms',
      metadata: {
        success,
        _error
        complexity: execution.complexity,
      },
    });

    // Record resource usage metrics if available
    if (resourceUsage) {
      this.recordMetric({
        agent_id: agentId,
        agent_name: agentName,
        agent_type: agentType,
        task_id: taskId,
        task_name: execution.taskName,
        metric_type: 'resource_usage',
        value: resourceUsage.cpu_percentage,
        unit: 'percentage',
        metadata: {
          memory_mb: resourceUsage.memory_mb,
          network_kb: resourceUsage.network_kb,
          disk_io_kb: resourceUsage.disk_io_kb,
        },
      });
    }

    // Record task complexity if available
    if (execution.complexity !== undefined) {
      this.recordMetric({
        agent_id: agentId,
        agent_name: agentName,
        agent_type: agentType,
        task_id: taskId,
        task_name: execution.taskName,
        metric_type: 'task_complexity',
        value: execution.complexity,
        unit: 'level',
      });
    }

    this.activeExecutions.delete(key);

    // Emit real-time event
    if (this.config.realTimeUpdates) {
      this.emit('taskCompleted', {
        agentId,
        agentName,
        taskId,
        taskName: execution.taskName,
        executionTime,
        success,
        _error
      });
    }
  }

  // Record a performance metric
  private recordMetric(metric: PerformanceMetric): void {
    const validated = PerformanceMetricSchema.parse(metric);
    this.metricsBuffer.push(validated);

    // Emit real-time metric event
    if (this.config.realTimeUpdates) {
      this.emit('metricRecorded', validated);
    }
  }

  // Flush metrics buffer to database
  private async flushMetricsBuffer(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metricsToFlush = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      const { error} = await this.supabase
        .from('agent_performance_metrics')
        .insert(metricsToFlush);

      if (_error {
        throw error;
      }

      logger.debug('Flushed performance metrics', LogContext.PERFORMANCE, {
        count: metricsToFlush.length,
      });
    } catch (error) {
      logger.error('Failed to flush metrics to database', LogContext.PERFORMANCE, { error});
      // Re-add metrics to buffer for retry
      this.metricsBuffer.unshift(...metricsToFlush);
    }
  }

  // Get agent performance summary
  async getAgentPerformanceSummary(
    agentId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    successRate: number;
    avgExecutionTime: number;
    totalTasks: number;
    failedTasks: number;
    avgResourceUsage: ResourceUsage | null;
  }> {
    const query = this.supabase
      .from('agent_performance_metrics')
      .select('*')
      .eq('agent_id', agentId);

    if (startDate) {
      query.gte('timestamp', startDate.toISOString());
    }
    if (endDate) {
      query.lte('timestamp', endDate.toISOString());
    }

    const { data: metrics, error} = await query;

    if (_error {
      throw error;
    }

    if (!metrics || metrics.length === 0) {
      return {
        successRate: 0,
        avgExecutionTime: 0,
        totalTasks: 0,
        failedTasks: 0,
        avgResourceUsage: null,
      };
    }

    // Calculate summary statistics
    const executionMetrics = metrics.filter((m) => m.metric_type === 'execution_time');
    const totalTasks = executionMetrics.length;
    const successfulTasks = executionMetrics.filter((m) => m.metadata?.success === true).length;
    const failedTasks = executionMetrics.filter((m) => m.metadata?.success === false).length;
    const successRate = totalTasks > 0 ? (successfulTasks / totalTasks) * 100 : 0;

    const avgExecutionTime =
      executionMetrics.reduce((sum, m) => sum + m.value, 0) / (executionMetrics.length || 1);

    // Calculate average resource usage
    const resourceMetrics = metrics.filter((m) => m.metric_type === 'resource_usage');
    let avgResourceUsage: ResourceUsage | null = null;

    if (resourceMetrics.length > 0) {
      const totalCpu = resourceMetrics.reduce((sum, m) => sum + m.value, 0);
      const totalMemory = resourceMetrics.reduce((sum, m) => sum + (m.metadata?.memory_mb || 0), 0);

      avgResourceUsage = {
        cpu_percentage: totalCpu / resourceMetrics.length,
        memory_mb: totalMemory / resourceMetrics.length,
        network_kb: 0,
        disk_io_kb: 0,
      };
    }

    return {
      successRate,
      avgExecutionTime,
      totalTasks,
      failedTasks,
      avgResourceUsage,
    };
  }

  // Get performance trends
  async getPerformanceTrends(
    agentId: string,
    period: 'hour' | 'day' | 'week' | 'month',
    lookback = 7
  ): Promise<AggregatedMetrics[]> {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'hour':
        startDate.setHours(startDate.getHours() - lookback);
        break;
      case 'day':
        startDate.setDate(startDate.getDate() - lookback);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - lookback * 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - lookback);
        break;
    }

    const { data, error} = await this.supabase
      .from('agent_performance_aggregated')
      .select('*')
      .eq('agent_id', agentId)
      .eq('period', period)
      .gte('start_time', startDate.toISOString())
      .lte('end_time', endDate.toISOString())
      .order('start_time', { ascending: true });

    if (_error {
      throw error;
    }

    return data || [];
  }

  // Run aggregation for all periods
  private async runAggregation(): Promise<void> {
    for (const period of this.config.aggregationIntervals) {
      await this.aggregateMetrics(period);
    }
  }

  // Aggregate metrics for a specific period
  private async aggregateMetrics(
    period: 'minute' | 'hour' | 'day' | 'week' | 'month'
  ): Promise<void> {
    try {
      const { error} = await this.supabase.rpc('aggregate_performance_metrics', {
        p_period: period,
      });

      if (_error {
        throw error;
      }

      logger.debug('Completed metrics aggregation', LogContext.PERFORMANCE, { period });
    } catch (error) {
      logger.error('Failed to aggregate metrics', LogContext.PERFORMANCE, { period, error});
    }
  }

  // Clean up old metrics
  async cleanupOldMetrics(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.metricsRetentionDays);

    try {
      const { error} = await this.supabase
        .from('agent_performance_metrics')
        .delete()
        .lt('timestamp', cutoffDate.toISOString());

      if (_error {
        throw error;
      }

      logger.info('Cleaned up old performance metrics', LogContext.PERFORMANCE, { cutoffDate });
    } catch (error) {
      logger.error('Failed to cleanup old metrics', LogContext.PERFORMANCE, { error});
    }
  }

  // Get comparison between agents
  async compareAgents(
    agentIds: string[],
    startDate?: Date,
    endDate?: Date
  ): Promise<
    Map<
      string,
      {
        successRate: number;
        avgExecutionTime: number;
        totalTasks: number;
        reliability: number;
      }
    >
  > {
    const comparisons = new Map();

    for (const agentId of agentIds) {
      const summary = await this.getAgentPerformanceSummary(agentId, startDate, endDate);

      // Calculate reliability score based on success rate and consistency
      const reliability =
        summary.successRate * 0.7 +
        (summary.totalTasks > 0 ? Math.min(summary.totalTasks / 100, 1) * 30 : 0);

      comparisons.set(agentId, {
        successRate: summary.successRate,
        avgExecutionTime: summary.avgExecutionTime,
        totalTasks: summary.totalTasks,
        reliability,
      });
    }

    return comparisons;
  }

  // Cleanup
  destroy(): void {
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
    }
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    this.removeAllListeners();
  }
}

// Export singleton instance creator
export function createPerformanceTracker(
  config: PerformanceTrackerConfig
): AgentPerformanceTracker {
  return new AgentPerformanceTracker(config);
}

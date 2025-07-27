import type { Supabase.Client } from '@supabase/supabase-js';
import { Event.Emitter } from 'events';
import { z } from 'zod';
import { Log.Context, logger } from './utils/enhanced-logger'// Performance Metric Schemas;
const PerformanceMetric.Schema = zobject({
  id: zstring()optional();
  agent_id: zstring();
  agent_name: zstring();
  agent_type: zstring();
  task_id: zstring()optional();
  task_name: zstring()optional();
  metric_type: zenum(['execution_time', 'resource_usage', 'success_rate', 'task_complexity']);
  value: znumber();
  unit: zstring()optional();
  timestamp: zdate()default(() => new Date());
  metadata: zrecord(zany())optional()});
const AggregatedMetrics.Schema = zobject({
  agent_id: zstring();
  period: zenum(['minute', 'hour', 'day', 'week', 'month']);
  start_time: zdate();
  end_time: zdate();
  total_tasks: znumber();
  successful_tasks: znumber();
  failed_tasks: znumber();
  avg_execution_time: znumber();
  min_execution_time: znumber();
  max_execution_time: znumber();
  avg_cpu_usage: znumber()optional();
  avg_memory_usage: znumber()optional();
  complexity_handled: zrecord(znumber()), // complexity level -> count});
const ResourceUsage.Schema = zobject({
  cpu_percentage: znumber()min(0)max(100);
  memory_mb: znumber()min(0);
  network_kb: znumber()min(0)optional();
  disk_io_kb: znumber()min(0)optional()});
export type Performance.Metric = zinfer<typeof PerformanceMetric.Schema>
export type Aggregated.Metrics = zinfer<typeof AggregatedMetrics.Schema>
export type Resource.Usage = zinfer<typeof ResourceUsage.Schema>
interface PerformanceTrackerConfig {
  supabase: Supabase.Client;
  metricsRetention.Days?: number;
  aggregation.Intervals?: ('minute' | 'hour' | 'day' | 'week' | 'month')[];
  realTime.Updates?: boolean;
};

interface TaskExecution {
  task.Id: string;
  task.Name: string;
  agent.Id: string;
  start.Time: Date;
  end.Time?: Date;
  success?: boolean;
  error instanceof Error ? errormessage : String(error)  string;
  complexity?: number;
  resource.Usage?: Resource.Usage;
};

export class AgentPerformance.Tracker extends Event.Emitter {
  private supabase: Supabase.Client;
  private active.Executions: Map<string, Task.Execution> = new Map();
  private metrics.Buffer: Performance.Metric[] = [];
  private bufferFlush.Interval: NodeJS.Timeout | null = null;
  private aggregation.Interval: NodeJS.Timeout | null = null;
  private config: Required<PerformanceTracker.Config>
  constructor(config: PerformanceTracker.Config) {
    super();
    thissupabase = configsupabase;
    thisconfig = {
      supabase: configsupabase;
      metricsRetention.Days: configmetricsRetention.Days || 30;
      aggregation.Intervals: configaggregation.Intervals || ['hour', 'day', 'week'];
      realTime.Updates: configrealTime.Updates ?? true;
    };
    this.initializeBuffer.Flush();
    thisinitialize.Aggregation()};

  private initializeBuffer.Flush(): void {
    // Flush metrics buffer every 5 seconds;
    thisbufferFlush.Interval = set.Interval(() => {
      thisflushMetrics.Buffer()catch((error instanceof Error ? errormessage : String(error)=> {
        loggererror('Failed to flush metrics buffer', LogContextPERFORMANC.E, { error instanceof Error ? errormessage : String(error))})}, 5000)};

  private initialize.Aggregation(): void {
    // Run aggregation every 5 minutes;
    thisaggregation.Interval = set.Interval(
      () => {
        thisrun.Aggregation()catch((error instanceof Error ? errormessage : String(error)=> {
          loggererror('Failed to run aggregation', LogContextPERFORMANC.E, { error instanceof Error ? errormessage : String(error))})};
      5 * 60 * 1000)}// Track the start of a task execution;
  async startTask.Execution(
    agent.Id: string;
    agent.Name: string;
    agent.Type: string;
    task.Id: string;
    task.Name: string;
    complexity?: number): Promise<void> {
    const execution: Task.Execution = {
      task.Id;
      task.Name;
      agent.Id;
      start.Time: new Date();
      complexity;
    };
    thisactive.Executionsset(`${agent.Id}-${task.Id}`, execution)// Emit real-time event;
    if (thisconfigrealTime.Updates) {
      thisemit('task.Started', {
        agent.Id;
        agent.Name;
        task.Id;
        task.Name;
        start.Time: executionstart.Time})}}// Track the end of a task execution;
  async endTask.Execution(
    agent.Id: string;
    agent.Name: string;
    agent.Type: string;
    task.Id: string;
    success: boolean;
    error instanceof Error ? errormessage : String(error)  string;
    resource.Usage?: Resource.Usage): Promise<void> {
    const key = `${agent.Id}-${task.Id}`;
    const execution = thisactive.Executionsget(key);
    if (!execution) {
      loggerwarn('No active execution found for task', LogContextPERFORMANC.E, {
        agent.Id;
        task.Id});
      return};

    executionend.Time = new Date();
    executionsuccess = success;
    executionerror instanceof Error ? errormessage : String(error)  error;
    executionresource.Usage = resource.Usage;
    const execution.Time = executionendTimeget.Time() - executionstartTimeget.Time()// Record execution time metric;
    thisrecord.Metric({
      agent_id: agent.Id;
      agent_name: agent.Name;
      agent_type: agent.Type;
      task_id: task.Id;
      task_name: executiontask.Name;
      metric_type: 'execution_time';
      value: execution.Time;
      unit: 'ms';
      metadata: {
        success;
        error;
        complexity: executioncomplexity;
      }})// Record resource usage metrics if available;
    if (resource.Usage) {
      thisrecord.Metric({
        agent_id: agent.Id;
        agent_name: agent.Name;
        agent_type: agent.Type;
        task_id: task.Id;
        task_name: executiontask.Name;
        metric_type: 'resource_usage';
        value: resource.Usagecpu_percentage;
        unit: 'percentage';
        metadata: {
          memory_mb: resource.Usagememory_mb;
          network_kb: resource.Usagenetwork_kb;
          disk_io_kb: resource.Usagedisk_io_kb;
        }})}// Record task complexity if available;
    if (executioncomplexity !== undefined) {
      thisrecord.Metric({
        agent_id: agent.Id;
        agent_name: agent.Name;
        agent_type: agent.Type;
        task_id: task.Id;
        task_name: executiontask.Name;
        metric_type: 'task_complexity';
        value: executioncomplexity;
        unit: 'level'})};

    thisactive.Executionsdelete(key)// Emit real-time event;
    if (thisconfigrealTime.Updates) {
      thisemit('task.Completed', {
        agent.Id;
        agent.Name;
        task.Id;
        task.Name: executiontask.Name;
        execution.Time;
        success;
        error})}}// Record a performance metric;
  private record.Metric(metric: Performance.Metric): void {
    const validated = PerformanceMetric.Schemaparse(metric);
    thismetrics.Bufferpush(validated)// Emit real-time metric event;
    if (thisconfigrealTime.Updates) {
      thisemit('metric.Recorded', validated)}}// Flush metrics buffer to database;
  private async flushMetrics.Buffer(): Promise<void> {
    if (thismetrics.Bufferlength === 0) return;
    const metricsTo.Flush = [.thismetrics.Buffer];
    thismetrics.Buffer = [];
    try {
      const { error instanceof Error ? errormessage : String(error)  = await thissupabase;
        from('agent_performance_metrics');
        insert(metricsTo.Flush);
      if (error instanceof Error ? errormessage : String(error){
        throw error instanceof Error ? errormessage : String(error)};

      loggerdebug('Flushed performance metrics', LogContextPERFORMANC.E, {
        count: metricsTo.Flushlength})} catch (error) {
      loggererror('Failed to flush metrics to database', LogContextPERFORMANC.E, { error instanceof Error ? errormessage : String(error) )// Re-add metrics to buffer for retry;
      thismetrics.Bufferunshift(.metricsTo.Flush);
    }}// Get agent performance summary;
  async getAgentPerformance.Summary(
    agent.Id: string;
    start.Date?: Date;
    end.Date?: Date): Promise<{
    success.Rate: number;
    avgExecution.Time: number;
    total.Tasks: number;
    failed.Tasks: number;
    avgResource.Usage: Resource.Usage | null}> {
    const query = thissupabase;
      from('agent_performance_metrics');
      select('*');
      eq('agent_id', agent.Id);
    if (start.Date) {
      querygte('timestamp', startDatetoISO.String())};
    if (end.Date) {
      querylte('timestamp', endDatetoISO.String())};

    const { data: metrics, error instanceof Error ? errormessage : String(error)  = await query;
    if (error instanceof Error ? errormessage : String(error){
      throw error instanceof Error ? errormessage : String(error)};

    if (!metrics || metricslength === 0) {
      return {
        success.Rate: 0;
        avgExecution.Time: 0;
        total.Tasks: 0;
        failed.Tasks: 0;
        avgResource.Usage: null;
      }}// Calculate summary statistics;
    const execution.Metrics = metricsfilter((m) => mmetric_type === 'execution_time');
    const total.Tasks = execution.Metricslength;
    const successful.Tasks = execution.Metricsfilter((m) => mmetadata?success === true)length;
    const failed.Tasks = execution.Metricsfilter((m) => mmetadata?success === false)length;
    const success.Rate = total.Tasks > 0 ? (successful.Tasks / total.Tasks) * 100 : 0;
    const avgExecution.Time =
      execution.Metricsreduce((sum, m) => sum + mvalue, 0) / (execution.Metricslength || 1)// Calculate average resource usage;
    const resource.Metrics = metricsfilter((m) => mmetric_type === 'resource_usage');
    let avgResource.Usage: Resource.Usage | null = null;
    if (resource.Metricslength > 0) {
      const total.Cpu = resource.Metricsreduce((sum, m) => sum + mvalue, 0);
      const total.Memory = resource.Metricsreduce((sum, m) => sum + (mmetadata?memory_mb || 0), 0);
      avgResource.Usage = {
        cpu_percentage: total.Cpu / resource.Metricslength;
        memory_mb: total.Memory / resource.Metricslength;
        network_kb: 0;
        disk_io_kb: 0;
      }};

    return {
      success.Rate;
      avgExecution.Time;
      total.Tasks;
      failed.Tasks;
      avgResource.Usage}}// Get performance trends;
  async getPerformance.Trends(
    agent.Id: string;
    period: 'hour' | 'day' | 'week' | 'month';
    lookback = 7): Promise<Aggregated.Metrics[]> {
    const end.Date = new Date();
    const start.Date = new Date();
    switch (period) {
      case 'hour':
        startDateset.Hours(startDateget.Hours() - lookback);
        break;
      case 'day':
        startDateset.Date(startDateget.Date() - lookback);
        break;
      case 'week':
        startDateset.Date(startDateget.Date() - lookback * 7);
        break;
      case 'month':
        startDateset.Month(startDateget.Month() - lookback);
        break};

    const { data, error } = await thissupabase;
      from('agent_performance_aggregated');
      select('*');
      eq('agent_id', agent.Id);
      eq('period', period);
      gte('start_time', startDatetoISO.String());
      lte('end_time', endDatetoISO.String());
      order('start_time', { ascending: true });
    if (error instanceof Error ? errormessage : String(error){
      throw error instanceof Error ? errormessage : String(error)};

    return data || []}// Run aggregation for all periods;
  private async run.Aggregation(): Promise<void> {
    for (const period of thisconfigaggregation.Intervals) {
      await thisaggregate.Metrics(period);
    }}// Aggregate metrics for a specific period;
  private async aggregate.Metrics(
    period: 'minute' | 'hour' | 'day' | 'week' | 'month'): Promise<void> {
    try {
      const { error instanceof Error ? errormessage : String(error)  = await thissupabaserpc('aggregate_performance_metrics', {
        p_period: period});
      if (error instanceof Error ? errormessage : String(error){
        throw error instanceof Error ? errormessage : String(error)};

      loggerdebug('Completed metrics aggregation', LogContextPERFORMANC.E, { period })} catch (error) {
      loggererror('Failed to aggregate metrics', LogContextPERFORMANC.E, { period, error instanceof Error ? errormessage : String(error) );
    }}// Clean up old metrics;
  async cleanupOld.Metrics(): Promise<void> {
    const cutoff.Date = new Date();
    cutoffDateset.Date(cutoffDateget.Date() - thisconfigmetricsRetention.Days);
    try {
      const { error instanceof Error ? errormessage : String(error)  = await thissupabase;
        from('agent_performance_metrics');
        delete();
        lt('timestamp', cutoffDatetoISO.String());
      if (error instanceof Error ? errormessage : String(error){
        throw error instanceof Error ? errormessage : String(error)};

      loggerinfo('Cleaned up old performance metrics', LogContextPERFORMANC.E, { cutoff.Date })} catch (error) {
      loggererror('Failed to cleanup old metrics', LogContextPERFORMANC.E, { error instanceof Error ? errormessage : String(error) );
    }}// Get comparison between agents;
  async compare.Agents(
    agent.Ids: string[];
    start.Date?: Date;
    end.Date?: Date): Promise<
    Map<
      string;
      {
        success.Rate: number;
        avgExecution.Time: number;
        total.Tasks: number;
        reliability: number;
      }>
  > {
    const comparisons = new Map();
    for (const agent.Id of agent.Ids) {
      const summary = await thisgetAgentPerformance.Summary(agent.Id, start.Date, end.Date)// Calculate reliability score based on success rate and consistency;
      const reliability =
        summarysuccess.Rate * 0.7 +
        (summarytotal.Tasks > 0 ? Math.min(summarytotal.Tasks / 100, 1) * 30 : 0);
      comparisonsset(agent.Id, {
        success.Rate: summarysuccess.Rate;
        avgExecution.Time: summaryavgExecution.Time;
        total.Tasks: summarytotal.Tasks;
        reliability})};

    return comparisons}// Cleanup;
  destroy(): void {
    if (thisbufferFlush.Interval) {
      clear.Interval(thisbufferFlush.Interval)};
    if (thisaggregation.Interval) {
      clear.Interval(thisaggregation.Interval)};
    thisremoveAll.Listeners()}}// Export singleton instance creator;
export function createPerformance.Tracker(
  config: PerformanceTracker.Config): AgentPerformance.Tracker {
  return new AgentPerformance.Tracker(config)};

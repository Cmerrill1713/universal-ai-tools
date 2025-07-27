import type { Supabase.Client } from '@supabase/supabase-js';
import { Event.Emitter } from 'events';
import { z } from 'zod';
import { Log.Context, logger } from './utils/enhanced-logger'// Performance Metric Schemas;
const Performance.Metric.Schema = zobject({
  id: zstring()optional(),
  agent_id: zstring(),
  agent_name: zstring(),
  agent_type: zstring(),
  task_id: zstring()optional(),
  task_name: zstring()optional(),
  metric_type: zenum(['execution_time', 'resource_usage', 'success_rate', 'task_complexity']);
  value: znumber(),
  unit: zstring()optional(),
  timestamp: zdate()default(() => new Date()),
  metadata: zrecord(zany())optional()}),
const Aggregated.Metrics.Schema = zobject({
  agent_id: zstring(),
  period: zenum(['minute', 'hour', 'day', 'week', 'month']);
  start_time: zdate(),
  end_time: zdate(),
  total_tasks: znumber(),
  successful_tasks: znumber(),
  failed_tasks: znumber(),
  avg_execution_time: znumber(),
  min_execution_time: znumber(),
  max_execution_time: znumber(),
  avg_cpu_usage: znumber()optional(),
  avg_memory_usage: znumber()optional(),
  complexity_handled: zrecord(znumber()), // complexity level -> count});
const Resource.Usage.Schema = zobject({
  cpu_percentage: znumber()min(0)max(100),
  memory_mb: znumber()min(0),
  network_kb: znumber()min(0)optional(),
  disk_io_kb: znumber()min(0)optional()}),
export type Performance.Metric = zinfer<typeof Performance.Metric.Schema>
export type Aggregated.Metrics = zinfer<typeof Aggregated.Metrics.Schema>
export type Resource.Usage = zinfer<typeof Resource.Usage.Schema>
interface PerformanceTracker.Config {
  supabase: Supabase.Client,
  metrics.Retention.Days?: number;
  aggregation.Intervals?: ('minute' | 'hour' | 'day' | 'week' | 'month')[];
  real.Time.Updates?: boolean;
}
interface Task.Execution {
  task.Id: string,
  task.Name: string,
  agent.Id: string,
  start.Time: Date,
  end.Time?: Date;
  success?: boolean;
  error instanceof Error ? error.message : String(error)  string;
  complexity?: number;
  resource.Usage?: Resource.Usage;
}
export class Agent.Performance.Tracker.extends Event.Emitter {
  private supabase: Supabase.Client,
  private active.Executions: Map<string, Task.Execution> = new Map();
  private metrics.Buffer: Performance.Metric[] = [],
  private buffer.Flush.Interval: NodeJ.S.Timeout | null = null,
  private aggregation.Interval: NodeJ.S.Timeout | null = null,
  private config: Required<Performance.Tracker.Config>
  constructor(config: Performance.Tracker.Config) {
    super();
    thissupabase = configsupabase;
    thisconfig = {
      supabase: configsupabase,
      metrics.Retention.Days: configmetrics.Retention.Days || 30,
      aggregation.Intervals: configaggregation.Intervals || ['hour', 'day', 'week'];
      real.Time.Updates: configreal.Time.Updates ?? true,
}    this.initialize.Buffer.Flush();
    thisinitialize.Aggregation();

  private initialize.Buffer.Flush(): void {
    // Flush metrics buffer every 5 seconds;
    thisbuffer.Flush.Interval = set.Interval(() => {
      thisflush.Metrics.Buffer()catch((error instanceof Error ? error.message : String(error)=> {
        loggererror('Failed to flush metrics buffer', LogContextPERFORMAN.C.E, { error instanceof Error ? error.message : String(error))})}, 5000);

  private initialize.Aggregation(): void {
    // Run aggregation every 5 minutes;
    thisaggregation.Interval = set.Interval(
      () => {
        thisrun.Aggregation()catch((error instanceof Error ? error.message : String(error)=> {
          loggererror('Failed to run aggregation', LogContextPERFORMAN.C.E, { error instanceof Error ? error.message : String(error))});
      5 * 60 * 1000)}// Track the start of a task execution;
  async start.Task.Execution(
    agent.Id: string,
    agent.Name: string,
    agent.Type: string,
    task.Id: string,
    task.Name: string,
    complexity?: number): Promise<void> {
    const execution: Task.Execution = {
      task.Id;
      task.Name;
      agent.Id;
      start.Time: new Date(),
      complexity;
}    thisactive.Executionsset(`${agent.Id}-${task.Id}`, execution)// Emit real-time event;
    if (thisconfigreal.Time.Updates) {
      thisemit('task.Started', {
        agent.Id;
        agent.Name;
        task.Id;
        task.Name;
        start.Time: executionstart.Time})}}// Track the end of a task execution,
  async end.Task.Execution(
    agent.Id: string,
    agent.Name: string,
    agent.Type: string,
    task.Id: string,
    success: boolean,
    error instanceof Error ? error.message : String(error)  string;
    resource.Usage?: Resource.Usage): Promise<void> {
    const key = `${agent.Id}-${task.Id}`;
    const execution = thisactive.Executionsget(key);
    if (!execution) {
      loggerwarn('No active execution found for task', LogContextPERFORMAN.C.E, {
        agent.Id;
        task.Id});
      return;

    executionend.Time = new Date();
    executionsuccess = success;
    executionerror instanceof Error ? error.message : String(error)  error;
    executionresource.Usage = resource.Usage;
    const execution.Time = executionend.Timeget.Time() - executionstart.Timeget.Time()// Record execution time metric;
    thisrecord.Metric({
      agent_id: agent.Id,
      agent_name: agent.Name,
      agent_type: agent.Type,
      task_id: task.Id,
      task_name: executiontask.Name,
      metric_type: 'execution_time',
      value: execution.Time,
      unit: 'ms',
      metadata: {
        success;
        error;
        complexity: executioncomplexity,
      }})// Record resource usage metrics if available;
    if (resource.Usage) {
      thisrecord.Metric({
        agent_id: agent.Id,
        agent_name: agent.Name,
        agent_type: agent.Type,
        task_id: task.Id,
        task_name: executiontask.Name,
        metric_type: 'resource_usage',
        value: resource.Usagecpu_percentage,
        unit: 'percentage',
        metadata: {
          memory_mb: resource.Usagememory_mb,
          network_kb: resource.Usagenetwork_kb,
          disk_io_kb: resource.Usagedisk_io_kb,
        }})}// Record task complexity if available;
    if (executioncomplexity !== undefined) {
      thisrecord.Metric({
        agent_id: agent.Id,
        agent_name: agent.Name,
        agent_type: agent.Type,
        task_id: task.Id,
        task_name: executiontask.Name,
        metric_type: 'task_complexity',
        value: executioncomplexity,
        unit: 'level'}),

    thisactive.Executionsdelete(key)// Emit real-time event;
    if (thisconfigreal.Time.Updates) {
      thisemit('task.Completed', {
        agent.Id;
        agent.Name;
        task.Id;
        task.Name: executiontask.Name,
        execution.Time;
        success;
        error})}}// Record a performance metric;
  private record.Metric(metric: Performance.Metric): void {
    const validated = Performance.Metric.Schemaparse(metric);
    this.metrics.Bufferpush(validated)// Emit real-time metric event;
    if (thisconfigreal.Time.Updates) {
      thisemit('metric.Recorded', validated)}}// Flush metrics buffer to database;
  private async flush.Metrics.Buffer(): Promise<void> {
    if (this.metrics.Bufferlength === 0) return;
    const metrics.To.Flush = [.this.metrics.Buffer];
    this.metrics.Buffer = [];
    try {
      const { error instanceof Error ? error.message : String(error)  = await thissupabase;
        from('agent_performance_metrics');
        insert(metrics.To.Flush);
      if (error instanceof Error ? error.message : String(error){
        throw error instanceof Error ? error.message : String(error);

      loggerdebug('Flushed performance metrics', LogContextPERFORMAN.C.E, {
        count: metrics.To.Flushlength})} catch (error) {
      loggererror('Failed to flush metrics to database', LogContextPERFORMAN.C.E, { error instanceof Error ? error.message : String(error) )// Re-add metrics to buffer for retry;
      this.metrics.Bufferunshift(.metrics.To.Flush);
    }}// Get agent performance summary;
  async getAgent.Performance.Summary(
    agent.Id: string,
    start.Date?: Date;
    end.Date?: Date): Promise<{
    success.Rate: number,
    avg.Execution.Time: number,
    total.Tasks: number,
    failed.Tasks: number,
    avg.Resource.Usage: Resource.Usage | null}> {
    const query = thissupabase;
      from('agent_performance_metrics');
      select('*');
      eq('agent_id', agent.Id);
    if (start.Date) {
      querygte('timestamp', startDatetoIS.O.String());
    if (end.Date) {
      querylte('timestamp', endDatetoIS.O.String());

    const { data: metrics, error instanceof Error ? error.message : String(error)  = await query;
    if (error instanceof Error ? error.message : String(error){
      throw error instanceof Error ? error.message : String(error);

    if (!metrics || metricslength === 0) {
      return {
        success.Rate: 0,
        avg.Execution.Time: 0,
        total.Tasks: 0,
        failed.Tasks: 0,
        avg.Resource.Usage: null,
      }}// Calculate summary statistics;
    const execution.Metrics = metricsfilter((m) => mmetric_type === 'execution_time');
    const total.Tasks = execution.Metricslength;
    const successful.Tasks = execution.Metricsfilter((m) => mmetadata?success === true)length;
    const failed.Tasks = execution.Metricsfilter((m) => mmetadata?success === false)length;
    const success.Rate = total.Tasks > 0 ? (successful.Tasks / total.Tasks) * 100 : 0;
    const avg.Execution.Time =
      execution.Metricsreduce((sum, m) => sum + mvalue, 0) / (execution.Metricslength || 1)// Calculate average resource usage;
    const resource.Metrics = metricsfilter((m) => mmetric_type === 'resource_usage');
    let avg.Resource.Usage: Resource.Usage | null = null,
    if (resource.Metricslength > 0) {
      const total.Cpu = resource.Metricsreduce((sum, m) => sum + mvalue, 0);
      const total.Memory = resource.Metricsreduce((sum, m) => sum + (mmetadata?memory_mb || 0), 0);
      avg.Resource.Usage = {
        cpu_percentage: total.Cpu / resource.Metricslength,
        memory_mb: total.Memory / resource.Metricslength,
        network_kb: 0,
        disk_io_kb: 0,
      };

    return {
      success.Rate;
      avg.Execution.Time;
      total.Tasks;
      failed.Tasks;
      avg.Resource.Usage}}// Get performance trends;
  async get.Performance.Trends(
    agent.Id: string,
    period: 'hour' | 'day' | 'week' | 'month',
    lookback = 7): Promise<Aggregated.Metrics[]> {
    const end.Date = new Date();
    const start.Date = new Date();
    switch (period) {
      case 'hour':
        start.Dateset.Hours(start.Dateget.Hours() - lookback);
        break;
      case 'day':
        start.Dateset.Date(start.Dateget.Date() - lookback);
        break;
      case 'week':
        start.Dateset.Date(start.Dateget.Date() - lookback * 7);
        break;
      case 'month':
        start.Dateset.Month(start.Dateget.Month() - lookback);
        break;

    const { data, error } = await thissupabase;
      from('agent_performance_aggregated');
      select('*');
      eq('agent_id', agent.Id);
      eq('period', period);
      gte('start_time', startDatetoIS.O.String());
      lte('end_time', endDatetoIS.O.String());
      order('start_time', { ascending: true }),
    if (error instanceof Error ? error.message : String(error){
      throw error instanceof Error ? error.message : String(error);

    return data || []}// Run aggregation for all periods;
  private async run.Aggregation(): Promise<void> {
    for (const period of thisconfigaggregation.Intervals) {
      await thisaggregate.Metrics(period);
    }}// Aggregate metrics for a specific period;
  private async aggregate.Metrics(
    period: 'minute' | 'hour' | 'day' | 'week' | 'month'): Promise<void> {
    try {
      const { error instanceof Error ? error.message : String(error)  = await thissupabaserpc('aggregate_performance_metrics', {
        p_period: period}),
      if (error instanceof Error ? error.message : String(error){
        throw error instanceof Error ? error.message : String(error);

      loggerdebug('Completed metrics aggregation', LogContextPERFORMAN.C.E, { period })} catch (error) {
      loggererror('Failed to aggregate metrics', LogContextPERFORMAN.C.E, { period, error instanceof Error ? error.message : String(error) );
    }}// Clean up old metrics;
  async cleanup.Old.Metrics(): Promise<void> {
    const cutoff.Date = new Date();
    cutoff.Dateset.Date(cutoff.Dateget.Date() - thisconfigmetrics.Retention.Days);
    try {
      const { error instanceof Error ? error.message : String(error)  = await thissupabase;
        from('agent_performance_metrics');
        delete();
        lt('timestamp', cutoffDatetoIS.O.String());
      if (error instanceof Error ? error.message : String(error){
        throw error instanceof Error ? error.message : String(error);

      loggerinfo('Cleaned up old performance metrics', LogContextPERFORMAN.C.E, { cutoff.Date })} catch (error) {
      loggererror('Failed to cleanup old metrics', LogContextPERFORMAN.C.E, { error instanceof Error ? error.message : String(error) );
    }}// Get comparison between agents;
  async compare.Agents(
    agent.Ids: string[],
    start.Date?: Date;
    end.Date?: Date): Promise<
    Map<
      string;
      {
        success.Rate: number,
        avg.Execution.Time: number,
        total.Tasks: number,
        reliability: number,
      }>
  > {
    const comparisons = new Map();
    for (const agent.Id.of agent.Ids) {
      const summary = await thisgetAgent.Performance.Summary(agent.Id, start.Date, end.Date)// Calculate reliability score based on success rate and consistency;
      const reliability =
        summarysuccess.Rate * 0.7 +
        (summarytotal.Tasks > 0 ? Math.min(summarytotal.Tasks / 100, 1) * 30 : 0);
      comparisonsset(agent.Id, {
        success.Rate: summarysuccess.Rate,
        avg.Execution.Time: summaryavg.Execution.Time,
        total.Tasks: summarytotal.Tasks,
        reliability});

    return comparisons}// Cleanup;
  destroy(): void {
    if (thisbuffer.Flush.Interval) {
      clear.Interval(thisbuffer.Flush.Interval);
    if (thisaggregation.Interval) {
      clear.Interval(thisaggregation.Interval);
    thisremove.All.Listeners()}}// Export singleton instance creator;
export function create.Performance.Tracker(
  config: Performance.Tracker.Config): Agent.Performance.Tracker {
  return new Agent.Performance.Tracker(config);

import { Log.Context, logger  } from './enhanced-logger';
import { Event.Emitter  } from 'events';
export interface Performance.Metrics {
  memory.Usage: NodeJS.Memory.Usage,
  cpu.Usage: NodeJS.Cpu.Usage,
  uptime: number,
  timestamp: number,
  active.Connections: number,
  requests.Per.Second: number,
  response.Time: number,
  error.Rate: number,
  cache.Hit.Rate: number,
  database.Connections: number,
  queue.Size: number,
  heapUsed.M.B: number,
  heapTotal.M.B: number,
  external.M.B: number,
  rss: number,
  gc?: {
    count: number,
    duration: number,
  };
  export interface Performance.Thresholds {
  memory.Threshold: number// M.B,
  cpu.Threshold: number// percentage,
  response.Time.Threshold: number// ms,
  error.Rate.Threshold: number// percentage,
  cacheHit.Rate.Threshold: number// percentage,
  export class Performance.Monitor.extends Event.Emitter {
  private metrics: Performance.Metrics[] = [],
  private request.Count = 0;
  private error.Count = 0;
  private response.Time.Sum = 0;
  private cache.Hits = 0;
  private cache.Requests = 0;
  private active.Connections = 0;
  private database.Connections = 0;
  private queue.Size = 0;
  private gc.Count = 0;
  private gc.Duration = 0;
  private start.Time = processhrtime();
  private last.Cpu.Usage = processcpu.Usage();
  private monitoring.Interval?: NodeJ.S.Timeout;
  private readonly thresholds: Performance.Thresholds = {
    memory.Threshold: 1024, // 1G.B;
    cpu.Threshold: 80, // 80%;
    response.Time.Threshold: 2000, // 2 seconds;
    error.Rate.Threshold: 5, // 5%;
    cacheHit.Rate.Threshold: 80, // 80%;
  constructor() {
    super();
    thissetupG.C.Monitoring();
  private setupG.C.Monitoring(): void {
    try {
      // G.C.monitoring is not available in E.S.modules currently// Will be implemented when Nodejs provides E.S.module support for perf_hooks} catch (error) {
      loggerwarn('G.C.monitoring not available: ', LogContextPERFORMAN.C.E, { error instanceof Error ? error.message : String(error)});'};
  public start.Monitoring(interval.Ms = 10000): void {
    if (thismonitoring.Interval) {
      clear.Interval(thismonitoring.Interval);

    thismonitoring.Interval = set.Interval(() => {
      const metrics = thiscollect.Metrics();
      this.metricspush(metrics);
      thischeck.Thresholds(metrics);
      thiscleanup.Old.Metrics()}, interval.Ms);
    loggerinfo('Performance monitoring started');';
  public stop.Monitoring(): void {
    if (thismonitoring.Interval) {
      clear.Interval(thismonitoring.Interval);
      thismonitoring.Interval = undefined;
    loggerinfo('Performance monitoring stopped');';
  private collect.Metrics(): Performance.Metrics {
    const memory.Usage = processmemory.Usage();
    const cpu.Usage = processcpu.Usage(thislast.Cpu.Usage);
    thislast.Cpu.Usage = processcpu.Usage();
    const metrics: Performance.Metrics = {
      memory.Usage;
      cpu.Usage;
      uptime: processuptime(),
      timestamp: Date.now(),
      active.Connections: thisactive.Connections,
      requests.Per.Second: thiscalculateRequests.Per.Second(),
      response.Time: thiscalculateAverage.Response.Time(),
      error.Rate: thiscalculate.Error.Rate(),
      cache.Hit.Rate: thiscalculateCache.Hit.Rate(),
      database.Connections: thisdatabase.Connections,
      queue.Size: thisqueue.Size,
      heapUsed.M.B: Mathround(memory.Usageheap.Used / 1024 / 1024),
      heapTotal.M.B: Mathround(memory.Usageheap.Total / 1024 / 1024),
      external.M.B: Mathround(memory.Usageexternal / 1024 / 1024),
      rss: Mathround(memory.Usagerss / 1024 / 1024),
      gc: {
        count: thisgc.Count,
        duration: thisgc.Duration,
      };
    return metrics;
  private calculateRequests.Per.Second(): number {
    const now = Date.now();
    const ten.Seconds.Ago = now - 10000;
    const recent.Requests = this.metricsfilter((m) => mtimestamp > ten.Seconds.Ago);
    return recent.Requestslength > 0 ? thisrequest.Count / 10: 0;
  private calculateAverage.Response.Time(): number {
    return thisrequest.Count > 0 ? thisresponse.Time.Sum / thisrequest.Count: 0,
  private calculate.Error.Rate(): number {
    return thisrequest.Count > 0 ? (thiserror.Count / thisrequest.Count) * 100: 0;
  private calculateCache.Hit.Rate(): number {
    return this.cache.Requests > 0 ? (this.cache.Hits / this.cache.Requests) * 100: 0;
  private check.Thresholds(metrics: Performance.Metrics): void {
    // Memory threshold;
    if (metricsheapUsed.M.B > thisthresholdsmemory.Threshold) {
      thisemit('threshold-exceeded', {');
        type: 'memory',';
        value: metricsheapUsed.M.B,
        threshold: thisthresholdsmemory.Threshold,
        message: `Memory usage exceeded, threshold: ${metricsheapUsed.M.B)}M.B > ${thisthresholdsmemory.Threshold}M.B`})}// Response time threshold,
    if (metricsresponse.Time > thisthresholdsresponse.Time.Threshold) {
      thisemit('threshold-exceeded', {');
        type: 'response-time',';
        value: metricsresponse.Time,
        threshold: thisthresholdsresponse.Time.Threshold,
        message: `Response time exceeded, threshold: ${metricsresponse.Time)}ms > ${thisthresholdsresponse.Time.Threshold}ms`})}// Error rate threshold,
    if (metricserror.Rate > thisthresholdserror.Rate.Threshold) {
      thisemit('threshold-exceeded', {');
        type: 'error-rate',';
        value: metricserror.Rate,
        threshold: thisthresholdserror.Rate.Threshold,
        message: `Error rate exceeded, threshold: ${metricserror.Rate)}% > ${thisthresholdserror.Rate.Threshold}%`})}// Cache hit rate threshold (low is bad),
    if (metricscache.Hit.Rate < thisthresholdscacheHit.Rate.Threshold && this.cache.Requests > 100) {
      thisemit('threshold-exceeded', {');
        type: 'cache-hit-rate',';
        value: metricscache.Hit.Rate,
        threshold: thisthresholdscacheHit.Rate.Threshold,
        message: `Cache hit rate below, threshold: ${metricscache.Hit.Rate)}% < ${thisthresholdscacheHit.Rate.Threshold}%`})},
  private cleanup.Old.Metrics(): void {
    const one.Hour.Ago = Date.now() - 3600000;
    this.metrics = this.metricsfilter((m) => mtimestamp > one.Hour.Ago)}// Public methods for updating metrics;
  public record.Request(response.Time: number, is.Error = false): void {
    thisrequest.Count++
    thisresponse.Time.Sum += response.Time;
    if (is.Error) {
      thiserror.Count++
    };
  public record.Cache.Access(hit: boolean): void {
    this.cache.Requests++
    if (hit) {
      this.cache.Hits++
    };
  public update.Connection.Count(count: number): void {
    thisactive.Connections = count;
}  public update.Database.Connections(count: number): void {
    thisdatabase.Connections = count;
}  public update.Queue.Size(size: number): void {
    thisqueue.Size = size;
}  public get.Metrics(): Performance.Metrics[] {
    return [.this.metrics];
  public get.Current.Metrics(): Performance.Metrics {
    return thiscollect.Metrics();
  public get.Aggregated.Metrics(duration.Ms = 300000): {
    average.Memory.Usage: number,
    average.Response.Time: number,
    total.Requests: number,
    error.Rate: number,
    cache.Hit.Rate: number,
    peak.Memory.Usage: number,
    peak.Response.Time: number} {
    const cutoff.Time = Date.now() - duration.Ms;
    const relevant.Metrics = this.metricsfilter((m) => mtimestamp > cutoff.Time);
    if (relevant.Metricslength === 0) {
      return {
        average.Memory.Usage: 0,
        average.Response.Time: 0,
        total.Requests: 0,
        error.Rate: 0,
        cache.Hit.Rate: 0,
        peak.Memory.Usage: 0,
        peak.Response.Time: 0,
      };

    const total.Memory = relevant.Metricsreduce((sum, m) => sum + mheapUsed.M.B, 0);
    const total.Response.Time = relevant.Metricsreduce((sum, m) => sum + mresponse.Time, 0);
    const peak.Memory = Math.max(.relevant.Metricsmap((m) => mheapUsed.M.B));
    const peak.Response.Time = Math.max(.relevant.Metricsmap((m) => mresponse.Time));
    return {
      average.Memory.Usage: total.Memory / relevant.Metricslength,
      average.Response.Time: total.Response.Time / relevant.Metricslength,
      total.Requests: thisrequest.Count,
      error.Rate: thiscalculate.Error.Rate(),
      cache.Hit.Rate: thiscalculateCache.Hit.Rate(),
      peak.Memory.Usage: peak.Memory,
      peak.Response.Time;
    };
  public force.Garbage.Collection(): void {
    try {
      if (globalgc) {
        globalgc();
        loggerinfo('Garbage collection forced');'} else {
        loggerwarn('Garbage collection not available (run with --expose-gc)');'}} catch (error) {
      loggererror('Error forcing garbage collection: ', LogContextPERFORMAN.C.E, { error instanceof Error ? error.message : String(error)});'};
  public generate.Report(): string {
    const current = thisget.Current.Metrics();
    const aggregated = thisget.Aggregated.Metrics();
    return `=== Performance Report ===
Current Memory Usage: ${currentheapUsed.M.B}M.B / ${currentheapTotal.M.B}M.B,
Current Response Time: ${currentresponse.Time}ms,
Current Error Rate: ${currenterror.Rate}%,
Current Cache Hit Rate: ${currentcache.Hit.Rate}%,
Active Connections: ${currentactive.Connections,
Database Connections: ${currentdatabase.Connections,
Queue Size: ${currentqueue.Size,
Uptime: ${Mathround(currentuptime / 3600)}h ${Mathround((currentuptime % 3600) / 60)}m=== 5-Minute Averages ===
Average Memory Usage: ${aggregatedaverageMemory.Usageto.Fixed(2)}M.B,
Average Response Time: ${aggregatedaverageResponse.Timeto.Fixed(2)}ms,
Peak Memory Usage: ${aggregatedpeak.Memory.Usage}M.B,
Peak Response Time: ${aggregatedpeak.Response.Time}ms,
Total Requests: ${aggregatedtotal.Requests,
Error Rate: ${aggregatederror.Rateto.Fixed(2)}%,
Cache Hit Rate: ${aggregatedcacheHit.Rateto.Fixed(2)}%=== Garbage Collection ===
G.C.Count: ${currentgc?count || 0,
Total G.C.Duration: ${currentgc?duration || 0}ms,
`};
  export const performance.Monitor = new Performance.Monitor();
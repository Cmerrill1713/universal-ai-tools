import type { Next.Function, Request, Response } from 'express';
import type { Supabase.Client } from '@supabase/supabase-js';
import { performance.Monitor } from './utils/performance-monitor';
import { ImprovedCache.Manager } from './utils/cache-manager-improved';
import Database.Optimizer from './utils/database-optimizer';
import { Log.Context, logger } from './utils/enhanced-logger';
import { config } from './config';
export interface PerformanceMiddleware.Options {
  enableRequest.Timing?: boolean;
  enableMemory.Monitoring?: boolean;
  enableCache.Metrics?: boolean;
  enableDatabase.Optimization?: boolean;
  slowRequest.Threshold?: number;
  memory.Threshold?: number;
  requestTimeout.Ms?: number;
};

export interface Request.Metrics {
  url: string;
  method: string;
  status.Code: number;
  response.Time: number;
  memory.Usage: number;
  user.Agent?: string;
  ip?: string;
  cached?: boolean;
  timestamp: number;
};

export class Performance.Middleware {
  private cache: ImprovedCache.Manager;
  private db.Optimizer: Database.Optimizer;
  private options: PerformanceMiddleware.Options;
  private request.Metrics: Request.Metrics[] = [];
  private maxMetrics.History = 10000;
  constructor(supabase: Supabase.Client, options: PerformanceMiddleware.Options = {}) {
    thisoptions = {
      enableRequest.Timing: true;
      enableMemory.Monitoring: true;
      enableCache.Metrics: true;
      enableDatabase.Optimization: true;
      slowRequest.Threshold: 2000, // 2 seconds;
      memory.Threshold: 1024, // 1G.B;
      requestTimeout.Ms: 30000, // 30 seconds.options};
    thiscache = new ImprovedCache.Manager(configredis?url || 'redis://localhost:6379');
    thisdb.Optimizer = new Database.Optimizer(supabase, thiscache);
    thisinitialize.Monitoring()};

  private initialize.Monitoring(): void {
    if (thisoptionsenableMemory.Monitoring) {
      performanceMonitorstart.Monitoring(10000)// 10 seconds;
      performance.Monitoron('threshold-exceeded', (event) => {
        loggerwarn('Performance threshold exceeded', LogContextPERFORMANC.E, { event });
        thishandleThreshold.Exceeded(event)})}};

  private handleThreshold.Exceeded(event: any): void {
    switch (eventtype) {
      case 'memory':
        thishandleMemory.Threshold(event);
        break;
      case 'response-time':
        thishandleResponseTime.Threshold(event);
        break;
      case 'errorrate':
        thishandleErrorRate.Threshold(event);
        break;
      case 'cache-hit-rate':
        thishandleCacheHitRate.Threshold(event);
        break}};

  private handleMemory.Threshold(event: any): void {
    loggerwarn(`Memory threshold exceeded: ${eventvalue}M.B`, LogContextPERFORMANC.E)// Force garbage collection;
    performanceMonitorforceGarbage.Collection()// Clear old metrics;
    thiscleanupOld.Metrics()// Optionally restart workers or clear caches;
    if (eventvalue > thisoptionsmemory.Threshold! * 1.5) {
      loggererror('Critical memory usage detected, clearing caches', LogContextPERFORMANC.E);
      thiscacheflush()}};

  private handleResponseTime.Threshold(event: any): void {
    loggerwarn(`Response time threshold exceeded: ${eventvalue}ms`, LogContextPERFORMANC.E)// Could implement requestqueuing or load balancing here};

  private handleErrorRate.Threshold(event: any): void {
    loggerwarn(`Error rate threshold exceeded: ${eventvalue}%`, LogContextPERFORMANC.E)// Could implement circuit breaker _patternhere};

  private handleCacheHitRate.Threshold(event: any): void {
    loggerwarn(`Cache hit rate below threshold: ${eventvalue}%`, LogContextPERFORMANC.E)// Could implement cache warming strategies here};

  private cleanupOld.Metrics(): void {
    const oneHour.Ago = Date.now() - 3600000;
    thisrequest.Metrics = thisrequest.Metricsfilter((m) => mtimestamp > oneHour.Ago);
    if (thisrequest.Metricslength > thismaxMetrics.History) {
      thisrequest.Metrics = thisrequest.Metricsslice(-thismaxMetrics.History)}};

  public request.Timer() {
    return (req: Request, res: Response, next: Next.Function) => {
      if (!thisoptionsenableRequest.Timing) {
        return next()};

      const start.Time = processhrtime();
      const start.Memory = processmemory.Usage()heap.Used// Set requesttimeout;
      const timeout = set.Timeout(() => {
        if (!resheaders.Sent) {
          resstatus(408)json({ error instanceof Error ? errormessage : String(error) 'Request timeout' })}}, thisoptionsrequestTimeout.Ms)// Override resend to capture metrics;
      const original.End = resend;
      const self = this;
      resend = function (this: Response, .args: any[]) {
        clear.Timeout(timeout);
        const [seconds, nanoseconds] = processhrtime(start.Time);
        const response.Time = seconds * 1000 + nanoseconds / 1000000;
        const end.Memory = processmemory.Usage()heap.Used;
        const memory.Usage = end.Memory - start.Memory;
        const metrics: Request.Metrics = {
          url: reqoriginal.Url || requrl;
          method: reqmethod;
          status.Code: resstatus.Code;
          response.Time;
          memory.Usage;
          user.Agent: reqheaders['user-agent'];
          ip: reqip || reqconnectionremote.Address;
          timestamp: Date.now();
        }// Record metrics;
        const is.Error = resstatus.Code >= 400;
        performanceMonitorrecord.Request(response.Time, is.Error)// Store metrics;
        selfrequest.Metricspush(metrics)// Log errors with more detail;
        if (is.Error) {
          loggererror;
            `Request error instanceof Error ? errormessage : String(error) ${reqmethod} ${requrl} - Status: ${resstatus.Code} - Response time: ${response.Time}ms`;
            LogContextPERFORMANC.E;
            {
              method: reqmethod;
              url: requrl;
              status.Code: resstatus.Code;
              response.Time;
              headers: reqheaders;
              ip: reqip;
            })}// Log slow requests;
        if (response.Time > selfoptionsslowRequest.Threshold!) {
          loggerwarn(
            `Slow requestdetected: ${reqmethod} ${requrl} - ${response.Time}ms`;
            LogContextPERFORMANC.E)}// Log high memory usage;
        if (memory.Usage > 50 * 1024 * 1024) {
          // 50M.B;
          loggerwarn(
            `High memory usage request${reqmethod} ${requrl} - ${memory.Usage / 1024 / 1024}M.B`;
            LogContextPERFORMANC.E)};

        return original.Endapply(this, args as any)};
      next()}};

  public response.Cache(default.Ttl = 3600) {
    return (req: Request, res: Response, next: Next.Function) => {
      if (!thisoptionsenableCache.Metrics) {
        return next()}// Only cache GE.T requests;
      if (reqmethod !== 'GE.T') {
        return next()};

      const cache.Key = thiscachecreateCache.Key(
        reqoriginal.Url || requrl;
        JSO.N.stringify(reqquery))// Try to get from cache;
      thiscache;
        get(cache.Key);
        then((cached) => {
          if (cached) {
            // Mark as cached for metrics;
            (res as any)from.Cache = true;
            resset('X-Cache', 'HI.T');
            resjson(cached);
            return}// Cache miss, continue to handler;
          resset('X-Cache', 'MIS.S')// Override resjson to cache the response;
          const original.Json = resjson;
          const self = this;
          resjson = function (this: Response, body: any) {
            // Cache successful responses;
            if (resstatus.Code < 400) {
              selfcacheset(cache.Key, body, {
                ttl: default.Ttl;
                tags: [reqroute?path || reqpath]})};
;
            return original.Jsoncall(this, body)};
          next()});
        catch((error instanceof Error ? errormessage : String(error)=> {
          loggererror('Cache middleware error instanceof Error ? errormessage : String(error)  LogContextPERFORMANC.E, { error instanceof Error ? errormessage : String(error));
          next()})}};

  public database.Optimizer() {
    return (req: Request, res: Response, next: Next.Function) => {
      if (!thisoptionsenableDatabase.Optimization) {
        return next()}// Add database optimizer to requestobject;
      (req as any)db.Optimizer = thisdb.Optimizer;
      next()}};

  public rate.Limiter(window.Ms = 900000, max = 100) {
    const requests = new Map<string, { count: number; reset.Time: number }>();
    return (req: Request, res: Response, next: Next.Function) => {
      const identifier = reqip || reqconnectionremote.Address || 'unknown';
      const now = Date.now();
      const user.Requests = requestsget(identifier);
      if (!user.Requests || now > userRequestsreset.Time) {
        requestsset(identifier, { count: 1, reset.Time: now + window.Ms });
        return next()};

      if (user.Requestscount >= max) {
        return resstatus(429)json({
          error instanceof Error ? errormessage : String(error) 'Too many requests';
          retry.After: Mathceil((userRequestsreset.Time - now) / 1000)})};

      user.Requestscount++
      next()}};

  public compression.Middleware() {
    return (req: Request, res: Response, next: Next.Function) => {
      const accept.Encoding = reqheaders['accept-encoding'] || '';
      if (accept.Encodingincludes('gzip')) {
        resset('Content-Encoding', 'gzip')} else if (accept.Encodingincludes('deflate')) {
        resset('Content-Encoding', 'deflate')};

      next()}};

  public async get.Metrics() {
    const [performance.Stats, cache.Stats, db.Stats] = await Promiseall([
      performanceMonitorgetAggregated.Metrics();
      thiscacheget.Stats();
      thisdbOptimizerget.Stats()]);
    const request.Stats = thisanalyzeRequest.Metrics();
    return {
      performance: performance.Stats;
      cache: cache.Stats;
      database: db.Stats;
      requests: request.Stats;
      timestamp: Date.now();
    }};

  private analyzeRequest.Metrics() {
    const now = Date.now();
    const last5.Minutes = thisrequest.Metricsfilter((m) => mtimestamp > now - 300000);
    const last1.Hour = thisrequest.Metricsfilter((m) => mtimestamp > now - 3600000);
    const calculate.Stats = (metrics: Request.Metrics[]) => {
      if (metricslength === 0) return { count: 0, avgResponse.Time: 0, error.Rate: 0 };
      const total.Time = metricsreduce((sum, m) => sum + mresponse.Time, 0);
      const errors = metricsfilter((m) => mstatus.Code >= 400)length;
      return {
        count: metricslength;
        avgResponse.Time: total.Time / metricslength;
        error.Rate: (errors / metricslength) * 100;
      }};
    return {
      last5.Minutes: calculate.Stats(last5.Minutes);
      last1.Hour: calculate.Stats(last1.Hour);
      slow.Requests: thisrequest.Metricsfilter(
        (m) => mresponse.Time > thisoptionsslowRequest.Threshold!)length;
      top.Endpoints: thisgetTop.Endpoints(last1.Hour);
    }};

  private getTop.Endpoints(
    metrics: Request.Metrics[]): Array<{ endpoint: string; count: number; avgResponse.Time: number }> {
    const endpoints = new Map<string, { count: number; total.Time: number }>();
    metricsfor.Each((metric) => {
      const endpoint = `${metricmethod} ${metricurl}`;
      const existing = endpointsget(endpoint) || { count: 0, total.Time: 0 };
      endpointsset(endpoint, {
        count: existingcount + 1;
        total.Time: existingtotal.Time + metricresponse.Time})});
    return Arrayfrom(endpointsentries());
      map(([endpoint, stats]) => ({
        endpoint;
        count: statscount;
        avgResponse.Time: statstotal.Time / statscount}));
      sort((a, b) => bcount - acount);
      slice(0, 10)};

  public async generatePerformance.Report(): Promise<string> {
    const metrics = await thisget.Metrics();
    const health.Checks = await thisrunHealth.Checks();
    return ``=== Universal A.I Tools Performance Report ===
Generated: ${new Date()toISO.String()}=== System Health ===
Overall Health: ${health.Checksoverall ? '✅ HEALTH.Y' : '❌ UNHEALTH.Y'};
Cache Health: ${health.Checkscache ? '✅ HEALTH.Y' : '❌ UNHEALTH.Y'};
Database Health: ${health.Checksdatabase ? '✅ HEALTH.Y' : '❌ UNHEALTH.Y'}=== Performance Metrics ===
Average Memory Usage: ${metricsperformanceaverageMemoryUsageto.Fixed(2)}M.B;
Peak Memory Usage: ${metricsperformancepeakMemory.Usage}M.B;
Average Response Time: ${metricsperformanceaverageResponseTimeto.Fixed(2)}ms;
Peak Response Time: ${metricsperformancepeakResponse.Time}ms;
Total Requests: ${metricsperformancetotal.Requests};
Error Rate: ${metricsperformanceerrorRateto.Fixed(2)}%=== Cache Performance ===
Hit Rate: ${metricscachehitRateto.Fixed(2)}%;
Total Hits: ${metricscachehits};
Total Misses: ${metricscachemisses};
Average Response Time: ${metricscacheavgResponseTimeto.Fixed(2)}ms;
Memory Usage: ${(metricscachememory.Usage / 1024 / 1024)to.Fixed(2)}M.B;
Key Count: ${metricscachekey.Count}=== Database Performance ===
Total Queries: ${metricsdatabasetotal.Queries};
Cached Queries: ${metricsdatabasecached.Queries};
Average Response Time: ${metricsdatabaseavgResponseTimeto.Fixed(2)}ms;
Slow Queries: ${metricsdatabaseslow.Queries};
Error Rate: ${((metricsdatabaseerrors / metricsdatabasetotal.Queries) * 100)to.Fixed(2)}%=== Request Analytics ===
Last 5 Minutes: ${metricsrequestslast5.Minutescount} requests;
Last Hour: ${metricsrequestslast1.Hourcount} requests;
Slow Requests: ${metricsrequestsslow.Requests}=== Top Endpoints ===
${metricsrequeststop.Endpoints;
  map((ep) => `${ependpoint}: ${epcount} requests (${epavgResponseTimeto.Fixed(2)}ms avg)`);
  join('\n')}=== Recommendations ===
${thisgenerate.Recommendations(metrics)};
`;`};

  private generate.Recommendations(metrics: any): string {
    const recommendations: string[] = [];
    if (metricsperformanceaverageMemory.Usage > 800) {
      recommendationspush('• Consider increasing memory limits or optimizing memory usage')};

    if (metricsperformanceaverageResponse.Time > 1000) {
      recommendationspush('• Response times are high - consider optimizing slow endpoints')};

    if (metricscachehit.Rate < 70) {
      recommendationspush('• Cache hit rate is low - review caching strategy')};

    if (metricsdatabaseavgResponse.Time > 500) {
      recommendationspush(
        '• Database queries are slow - consider adding indexes or optimizing queries')};

    if (recommendationslength === 0) {
      recommendationspush('• System is performing well - no immediate optimizations needed')};

    return recommendationsjoin('\n')};

  private async runHealth.Checks() {
    const [cache.Health, db.Health] = await Promiseall([
      thiscachehealth.Check();
      thisdbOptimizerhealth.Check()]);
    return {
      overall: cache.Healthhealthy && db.Healthhealthy;
      cache: cache.Healthhealthy;
      database: db.Healthhealthy;
    }};

  public async close(): Promise<void> {
    performanceMonitorstop.Monitoring();
    await thiscacheclose();
  }};

export default Performance.Middleware;
import type { Next.Function, Request, Response } from 'express';
import { Log.Context, logger } from './utils/enhanced-logger';
export interface FallbackPerformance.Options {
  slowRequest.Threshold?: number;
  requestTimeout.Ms?: number;
  maxMetrics.History?: number;
  enableRequest.Timing?: boolean;
};

interface Request.Metric {
  url: string;
  method: string;
  status.Code: number;
  response.Time: number;
  timestamp: number;
  user.Agent?: string;
  ip?: string;
};

interface RateLimit.Entry {
  count: number;
  reset.Time: number;
}/**
 * Lightweight performance middleware that works without Redis* Uses in-memory storage with automatic cleanup*/
export class FallbackPerformance.Middleware {
  private request.Metrics: Request.Metric[] = [];
  private rateLimit.Map = new Map<string, RateLimit.Entry>();
  private options: Required<FallbackPerformance.Options>
  private cleanup.Interval: NodeJS.Timeout;
  private metricsCleanup.Interval = 300000// 5 minutes;
  constructor(options: FallbackPerformance.Options = {}) {
    thisoptions = {
      slowRequest.Threshold: optionsslowRequest.Threshold ?? 2000;
      requestTimeout.Ms: optionsrequestTimeout.Ms ?? 5000, // 5 second max as requested;
      maxMetrics.History: optionsmaxMetrics.History ?? 5000;
      enableRequest.Timing: optionsenableRequest.Timing ?? true;
    }// Start cleanup interval;
    thiscleanup.Interval = set.Interval(() => {
      thiscleanupOld.Metrics();
      thiscleanupRate.Limits()}, thismetricsCleanup.Interval);
    loggerinfo('Fallback performance middleware initialized', LogContextPERFORMANC.E, {
      options: thisoptions})};

  private cleanupOld.Metrics(): void {
    const oneHour.Ago = Date.now() - 3600000;
    const before.Cleanup = thisrequest.Metricslength// Remove metrics older than 1 hour;
    thisrequest.Metrics = thisrequest.Metricsfilter((m) => mtimestamp > oneHour.Ago)// Keep only the most recent metrics if exceeding max;
    if (thisrequest.Metricslength > thisoptionsmaxMetrics.History) {
      thisrequest.Metrics = thisrequest.Metricsslice(-thisoptionsmaxMetrics.History)};
;
    const removed = before.Cleanup - thisrequest.Metricslength;
    if (removed > 0) {
      loggerdebug(`Cleaned up ${removed} old metrics`, LogContextPERFORMANC.E)}};

  private cleanupRate.Limits(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of thisrateLimit.Mapentries()) {
      if (now > entryreset.Time) {
        thisrateLimit.Mapdelete(key);
        cleaned++}};

    if (cleaned > 0) {
      loggerdebug(`Cleaned up ${cleaned} expired rate limit entries`, LogContextPERFORMANC.E)}}/**
   * Request timing middleware with timeout protection*/
  public request.Timer() {
    return (req: Request, res: Response, next: Next.Function) => {
      if (!thisoptionsenableRequest.Timing) {
        return next()};

      const start.Time = processhrtimebigint()// Set requesttimeout;
      const timeout = set.Timeout(() => {
        if (!resheaders.Sent) {
          resstatus(408)json({
            error instanceof Error ? errormessage : String(error) 'Request timeout';
            message: `Request exceeded ${thisoptionsrequestTimeout.Ms}ms timeout`});
          loggerwarn('Request timeout', LogContextPERFORMANC.E, {
            method: reqmethod;
            url: reqoriginal.Url || requrl;
            timeout: thisoptionsrequestTimeout.Ms})}}, thisoptionsrequestTimeout.Ms)// Override resend to capture metrics;
      const original.End = resend;
      const self = this;
      resend = function (this: Response, .args: any[]) {
        clear.Timeout(timeout);
        const end.Time = processhrtimebigint();
        const response.Time = Number(end.Time - start.Time) / 1000000// Convert to milliseconds// Record metric;
        const metric: Request.Metric = {
          url: reqoriginal.Url || requrl;
          method: reqmethod;
          status.Code: resstatus.Code;
          response.Time;
          timestamp: Date.now();
          user.Agent: reqheaders['user-agent'];
          ip: reqip || reqsocketremote.Address;
        };
        selfrequest.Metricspush(metric)// Log slow requests;
        if (response.Time > selfoptionsslowRequest.Threshold) {
          loggerwarn('Slow requestdetected', LogContextPERFORMANC.E, {
            .metric;
            threshold: selfoptionsslowRequest.Threshold})}// Log errors;
        if (resstatus.Code >= 400) {
          loggererror('Request error instanceof Error ? errormessage : String(error)  LogContextPERFORMANC.E, metric);'}// Add performance headers;
        resset('X-Response-Time', `${responseTimeto.Fixed(2)}ms`);
        resset('X-Performance-Mode', 'fallback');
        return original.Endapply(this, args as any)};
      next()}}/**
   * Simple in-memory rate limiter*/
  public rate.Limiter(window.Ms = 900000, max = 1000) {
    return (req: Request, res: Response, next: Next.Function) => {
      const identifier = reqip || reqsocketremote.Address || 'unknown';
      const now = Date.now();
      const user.Requests = thisrateLimit.Mapget(identifier);
      if (!user.Requests || now > userRequestsreset.Time) {
        thisrateLimit.Mapset(identifier, {
          count: 1;
          reset.Time: now + window.Ms});
        return next()};

      if (user.Requestscount >= max) {
        return resstatus(429)json({
          error instanceof Error ? errormessage : String(error) 'Too many requests';
          retry.After: Mathceil((userRequestsreset.Time - now) / 1000)})};

      user.Requestscount++
      next()}}/**
   * Generate a simple performance report*/
  public async generatePerformance.Report(): Promise<string> {
    const metrics = thisget.Metrics();
    const now = new Date()toISO.String();
    return ``=== Universal A.I Tools Performance Report (Fallback Mode) ===
Generated: ${now}=== System Status ===
Mode: ${metricsmodetoUpper.Case()};
Total Metrics Tracked: ${metricstotal.Metrics};
Active Rate Limit Entries: ${metricsrateLimit.Entries}=== Request Statistics (Last 5 Minutes) ===
Total Requests: ${metricslast5.Minutescount};
Average Response Time: ${metricslast5MinutesavgResponseTimeto.Fixed(2)}ms;
P95 Response Time: ${metricslast5Minutesp95ResponseTimeto.Fixed(2)}ms;
P99 Response Time: ${metricslast5Minutesp99ResponseTimeto.Fixed(2)}ms;
Error Rate: ${metricslast5MinuteserrorRateto.Fixed(2)}%=== Request Statistics (Last Hour) ===
Total Requests: ${metricslast1.Hourcount};
Average Response Time: ${metricslast1HouravgResponseTimeto.Fixed(2)}ms;
P95 Response Time: ${metricslast1Hourp95ResponseTimeto.Fixed(2)}ms;
P99 Response Time: ${metricslast1Hourp99ResponseTimeto.Fixed(2)}ms;
Error Rate: ${metricslast1HourerrorRateto.Fixed(2)}%=== Performance Issues ===
Slow Requests (>${thisoptionsslowRequest.Threshold}ms): ${metricsslow.Requests}=== Notes ===
• Running in fallback mode without Redis;
• Limited to in-memory metrics storage;
• Metrics are cleared on server restart;
• Maximum ${thisoptionsmaxMetrics.History} metrics retained;
• Request timeout protection: ${thisoptionsrequestTimeout.Ms}ms;
`;`}/**
   * Get current metrics summary*/
  public get.Metrics() {
    const now = Date.now();
    const last5.Minutes = thisrequest.Metricsfilter((m) => mtimestamp > now - 300000);
    const last1.Hour = thisrequest.Metricsfilter((m) => mtimestamp > now - 3600000);
    const calculate.Stats = (metrics: Request.Metric[]) => {
      if (metricslength === 0) {
        return {
          count: 0;
          avgResponse.Time: 0;
          error.Rate: 0;
          p95Response.Time: 0;
          p99Response.Time: 0;
        }};

      const response.Times = metricsmap((m) => mresponse.Time)sort((a, b) => a - b);
      const total.Time = response.Timesreduce((sum, time) => sum + time, 0);
      const errors = metricsfilter((m) => mstatus.Code >= 400)length;
      const p95.Index = Mathfloor(response.Timeslength * 0.95);
      const p99.Index = Mathfloor(response.Timeslength * 0.99);
      return {
        count: metricslength;
        avgResponse.Time: total.Time / metricslength;
        error.Rate: (errors / metricslength) * 100;
        p95Response.Time: response.Times[p95.Index] || 0;
        p99Response.Time: response.Times[p99.Index] || 0;
      }};
    return {
      mode: 'fallback';
      last5.Minutes: calculate.Stats(last5.Minutes);
      last1.Hour: calculate.Stats(last1.Hour);
      total.Metrics: thisrequest.Metricslength;
      rateLimit.Entries: thisrateLimit.Mapsize;
      slow.Requests: thisrequest.Metricsfilter(
        (m) => mresponse.Time > thisoptionsslowRequest.Threshold)length;
      timestamp: Date.now();
    }}/**
   * Cleanup resources*/
  public close(): void {
    if (thiscleanup.Interval) {
      clear.Interval(thiscleanup.Interval)};
    thisrequest.Metrics = [];
    thisrateLimit.Mapclear();
    loggerinfo('Fallback performance middleware closed', LogContextPERFORMANC.E)}}/**
 * Factory function to create fallback middleware instance*/
export function createFallbackPerformance.Middleware(options?: FallbackPerformance.Options) {
  return new FallbackPerformance.Middleware(options)};

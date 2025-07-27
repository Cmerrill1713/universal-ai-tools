/**
 * Redis Health Check Service* Provides comprehensive health monitoring for Redis infrastructure*/

import { get.Redis.Service } from './redis-service';
import { Log.Context, logger } from './utils/enhanced-logger';
import { performance } from 'perf_hooks';
export interface RedisHealth.Status {
  status: 'healthy' | 'degraded' | 'unhealthy',
  connected: boolean,
  latency: number,
  memory.Usage: string,
  connected.Clients: number,
  uptime: number,
  fallback.Cache.Active: boolean,
  fallback.Cache.Stats?: {
    size: number,
    item.Count: number,
}  last.Check: Date,
  details: {
    connection.Pool: {
      size: number,
      active: boolean,
}    read.Replicas: {
      count: number,
      healthy: number,
}    cluster.Mode: boolean,
    errors: string[],
    warnings: string[],
  };

export class RedisHealth.Check.Service {
  private static instance: RedisHealth.Check.Service,
  private last.Health.Check: Redis.Health.Status | null = null,
  private health.Check.Interval: NodeJ.S.Timeout | null = null,
  private readonly check.Interval.Ms = 30000// 30 seconds;
  private constructor() {;

  static get.Instance(): RedisHealth.Check.Service {
    if (!RedisHealth.Check.Serviceinstance) {
      RedisHealth.Check.Serviceinstance = new RedisHealth.Check.Service();
    return RedisHealth.Check.Serviceinstance}/**
   * Start periodic health checks*/
  startPeriodic.Health.Checks(): void {
    if (thishealth.Check.Interval) {
      return// Already running}// Perform initial health check;
    thisperform.Health.Check()catch((error instanceof Error ? error.message : String(error)=> {
      loggererror('Initial Redis health check failed', LogContextCAC.H.E, { error instanceof Error ? error.message : String(error))})// Set up periodic checks;
    thishealth.Check.Interval = set.Interval(() => {
      thisperform.Health.Check()catch((error instanceof Error ? error.message : String(error)=> {
        loggererror('Periodic Redis health check failed', LogContextCAC.H.E, { error instanceof Error ? error.message : String(error))})}, thischeck.Interval.Ms);
    loggerinfo('Started Redis periodic health checks', LogContextCAC.H.E, {
      interval: thischeck.Interval.Ms})}/**
   * Stop periodic health checks*/
  stopPeriodic.Health.Checks(): void {
    if (thishealth.Check.Interval) {
      clear.Interval(thishealth.Check.Interval);
      thishealth.Check.Interval = null;
      loggerinfo('Stopped Redis periodic health checks', LogContextCAC.H.E)}}/**
   * Perform a comprehensive health check*/
  async perform.Health.Check(): Promise<Redis.Health.Status> {
    const start.Time = performancenow();
    const errors: string[] = [],
    const warnings: string[] = [],
    try {
      const redis.Service = get.Redis.Service();
      const basic.Health = await redis.Servicehealth.Check();
      const stats = await redis.Serviceget.Stats();
      const fallback.Stats = redisServicegetFallback.Cache.Stats()// Determine overall status;
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy',
      if (!basic.Healthhealthy) {
        status = 'unhealthy';
        errorspush(basic.Healtherror.instanceof Error ? error.message : String(error) | 'Redis connection failed')} else if (basic.Healthlatency && basic.Healthlatency > 100) {
        status = 'degraded';
        warningspush(`High latency detected: ${basic.Healthlatency}ms`)}// Check memory usage,
      if (statsmemory.Usage) {
        const memory.Value = parse.Float(statsmemory.Usage);
        const memory.Unit = statsmemory.Usage.replace(/[0-9.]/g, '');
        if (memory.Unit === 'G' && memory.Value > 1.5) {
          warningspush(`High memory usage: ${statsmemory.Usage}`),
          if (status === 'healthy') status = 'degraded'}}// Check fallback cache;
      const fallback.Cache.Active = fallback.Statsitem.Count > 0 && !statsconnected;
      if (fallback.Cache.Active) {
        warningspush('Fallback cache is active - Redis may be down');
        status = 'degraded';

      const health.Status: Redis.Health.Status = {
        status;
        connected: statsconnected,
        latency: basic.Healthlatency || -1,
        memory.Usage: statsmemory.Usage || 'unknown',
        connected.Clients: statsconnected.Clients || 0,
        uptime: statsuptime || 0,
        fallback.Cache.Active;
        fallback.Cache.Stats: fallback.Stats,
        last.Check: new Date(),
        details: {
          connection.Pool: {
            size: parse.Int(process.envREDIS_POOL_SI.Z.E || '5', 10);
            active: statsconnected,
}          read.Replicas: {
            count: 0, // Will be updated when read replicas are configured;
            healthy: 0,
}          cluster.Mode: process.envREDIS_CLUSTER_MO.D.E === 'true',
          errors;
          warnings;
        }}// Cache the health status;
      thislast.Health.Check = health.Status// Log health status;
      const duration = performancenow() - start.Time;
      loggerinfo('Redis health check completed', LogContextCAC.H.E, {
        status: health.Statusstatus,
        duration: `${durationto.Fixed(2)}ms`,
        connected: health.Statusconnected,
        latency: health.Statuslatency}),
      return health.Status} catch (error) {
      const error.Message = error instanceof Error ? error.message : String(error instanceof Error ? error.message : String(error);
      errorspush(error.Message);
      const health.Status: Redis.Health.Status = {
        status: 'unhealthy',
        connected: false,
        latency: -1,
        memory.Usage: 'unknown',
        connected.Clients: 0,
        uptime: 0,
        fallback.Cache.Active: true,
        last.Check: new Date(),
        details: {
          connection.Pool: {
            size: parse.Int(process.envREDIS_POOL_SI.Z.E || '5', 10);
            active: false,
}          read.Replicas: {
            count: 0,
            healthy: 0,
}          cluster.Mode: false,
          errors;
          warnings;
        };
      thislast.Health.Check = health.Status;
      return health.Status}}/**
   * Get the last health check result*/
  getLast.Health.Check(): Redis.Health.Status | null {
    return thislast.Health.Check}/**
   * Get health status summary for monitoring*/
  get.Health.Summary(): {
    status: string,
    message: string,
    metrics: Record<string, unknown>} {
    const health = thislast.Health.Check;
    if (!health) {
      return {
        status: 'unknown',
        message: 'No health check performed yet',
        metrics: {
}};

    let message = 'Redis is operating normally';
    if (healthstatus === 'degraded') {
      message = 'Redis is experiencing issues'} else if (healthstatus === 'unhealthy') {
      message = 'Redis is unavailable';

    return {
      status: healthstatus,
      message;
      metrics: {
        connected: healthconnected,
        latency_ms: healthlatency,
        memory_usage: healthmemory.Usage,
        connected_clients: healthconnected.Clients,
        uptime_seconds: healthuptime,
        fallback_cache_active: healthfallback.Cache.Active,
        fallback_cache_items: healthfallback.Cache.Stats?item.Count || 0,
        errors_count: healthdetailserrorslength,
        warnings_count: healthdetailswarningslength,
        last_check: healthlastChecktoIS.O.String(),
      }}}/**
   * Test Redis operations*/
  async test.Redis.Operations(): Promise<{
    passed: boolean,
    results: Array<{
      operation: string,
      success: boolean,
      duration: number,
      error instanceof Error ? error.message : String(error)  string}>}> {
    const results: Array<{
      operation: string,
      success: boolean,
      duration: number,
      error instanceof Error ? error.message : String(error)  string}> = [];
    const redis.Service = get.Redis.Service();
    const test.Key = `health:test:${Date.now()}`;
    const test.Value = JS.O.N.stringify({
      test: true,
      timestamp: new Date()toIS.O.String()})// Test S.E.T.operation,
    const set.Start = performancenow();
    try {
      await redis.Serviceset(test.Key, test.Value, 60);
      resultspush({
        operation: 'S.E.T',
        success: true,
        duration: performancenow() - set.Start})} catch (error) {
      resultspush({
        operation: 'S.E.T',
        success: false,
        duration: performancenow() - set.Start,
        error instanceof Error ? error.message : String(error) error instanceof Error ? error.message : String(error instanceof Error ? error.message : String(error)})}// Test G.E.T.operation;
    const get.Start = performancenow();
    try {
      const retrieved = await redis.Serviceget(test.Key);
      const success = retrieved === test.Value;
      resultspush({
        operation: 'G.E.T',
        success;
        duration: performancenow() - get.Start,
        error instanceof Error ? error.message : String(error) success ? undefined : 'Value mismatch'})} catch (error) {
      resultspush({
        operation: 'G.E.T',
        success: false,
        duration: performancenow() - get.Start,
        error instanceof Error ? error.message : String(error) error instanceof Error ? error.message : String(error instanceof Error ? error.message : String(error)})}// Test EXIS.T.S.operation;
    const exists.Start = performancenow();
    try {
      const exists = await redis.Serviceexists(test.Key);
      resultspush({
        operation: 'EXIS.T.S',
        success: exists === 1,
        duration: performancenow() - exists.Start})} catch (error) {
      resultspush({
        operation: 'EXIS.T.S',
        success: false,
        duration: performancenow() - exists.Start,
        error instanceof Error ? error.message : String(error) error instanceof Error ? error.message : String(error instanceof Error ? error.message : String(error)})}// Test D.E.L.operation;
    const del.Start = performancenow();
    try {
      await redis.Servicedel(test.Key);
      resultspush({
        operation: 'D.E.L',
        success: true,
        duration: performancenow() - del.Start})} catch (error) {
      resultspush({
        operation: 'D.E.L',
        success: false,
        duration: performancenow() - del.Start,
        error instanceof Error ? error.message : String(error) error instanceof Error ? error.message : String(error instanceof Error ? error.message : String(error)});

    const passed = resultsevery((r) => rsuccess);
    loggerinfo('Redis operations test completed', LogContextCAC.H.E, {
      passed;
      total.Operations: resultslength,
      successful.Operations: resultsfilter((r) => rsuccess)length}),
    return { passed, results }}}// Export singleton instance;
export const redis.Health.Check = RedisHealthCheck.Serviceget.Instance();
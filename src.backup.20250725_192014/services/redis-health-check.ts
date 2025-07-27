/**
 * Redis Health Check Service* Provides comprehensive health monitoring for Redis infrastructure*/

import { getRedis.Service } from './redis-service';
import { Log.Context, logger } from './utils/enhanced-logger';
import { performance } from 'perf_hooks';
export interface RedisHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connected: boolean;
  latency: number;
  memory.Usage: string;
  connected.Clients: number;
  uptime: number;
  fallbackCache.Active: boolean;
  fallbackCache.Stats?: {
    size: number;
    item.Count: number;
  };
  last.Check: Date;
  details: {
    connection.Pool: {
      size: number;
      active: boolean;
    };
    read.Replicas: {
      count: number;
      healthy: number;
    };
    cluster.Mode: boolean;
    errors: string[];
    warnings: string[];
  }};

export class RedisHealthCheck.Service {
  private static instance: RedisHealthCheck.Service;
  private lastHealth.Check: RedisHealth.Status | null = null;
  private healthCheck.Interval: NodeJS.Timeout | null = null;
  private readonly checkInterval.Ms = 30000// 30 seconds;
  private constructor() {};

  static get.Instance(): RedisHealthCheck.Service {
    if (!RedisHealthCheck.Serviceinstance) {
      RedisHealthCheck.Serviceinstance = new RedisHealthCheck.Service()};
    return RedisHealthCheck.Serviceinstance}/**
   * Start periodic health checks*/
  startPeriodicHealth.Checks(): void {
    if (thishealthCheck.Interval) {
      return// Already running}// Perform initial health check;
    thisperformHealth.Check()catch((error instanceof Error ? errormessage : String(error)=> {
      loggererror('Initial Redis health check failed', LogContextCACH.E, { error instanceof Error ? errormessage : String(error))})// Set up periodic checks;
    thishealthCheck.Interval = set.Interval(() => {
      thisperformHealth.Check()catch((error instanceof Error ? errormessage : String(error)=> {
        loggererror('Periodic Redis health check failed', LogContextCACH.E, { error instanceof Error ? errormessage : String(error))})}, thischeckInterval.Ms);
    loggerinfo('Started Redis periodic health checks', LogContextCACH.E, {
      interval: thischeckInterval.Ms})}/**
   * Stop periodic health checks*/
  stopPeriodicHealth.Checks(): void {
    if (thishealthCheck.Interval) {
      clear.Interval(thishealthCheck.Interval);
      thishealthCheck.Interval = null;
      loggerinfo('Stopped Redis periodic health checks', LogContextCACH.E)}}/**
   * Perform a comprehensive health check*/
  async performHealth.Check(): Promise<RedisHealth.Status> {
    const start.Time = performancenow();
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      const redis.Service = getRedis.Service();
      const basic.Health = await redisServicehealth.Check();
      const stats = await redisServiceget.Stats();
      const fallback.Stats = redisServicegetFallbackCache.Stats()// Determine overall status;
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (!basic.Healthhealthy) {
        status = 'unhealthy';
        errorspush(basic.Healtherror instanceof Error ? errormessage : String(error) | 'Redis connection failed')} else if (basic.Healthlatency && basic.Healthlatency > 100) {
        status = 'degraded';
        warningspush(`High latency detected: ${basic.Healthlatency}ms`)}// Check memory usage;
      if (statsmemory.Usage) {
        const memory.Value = parse.Float(statsmemory.Usage);
        const memory.Unit = statsmemory.Usagereplace(/[0-9.]/g, '');
        if (memory.Unit === 'G' && memory.Value > 1.5) {
          warningspush(`High memory usage: ${statsmemory.Usage}`);
          if (status === 'healthy') status = 'degraded'}}// Check fallback cache;
      const fallbackCache.Active = fallbackStatsitem.Count > 0 && !statsconnected;
      if (fallbackCache.Active) {
        warningspush('Fallback cache is active - Redis may be down');
        status = 'degraded'};

      const health.Status: RedisHealth.Status = {
        status;
        connected: statsconnected;
        latency: basic.Healthlatency || -1;
        memory.Usage: statsmemory.Usage || 'unknown';
        connected.Clients: statsconnected.Clients || 0;
        uptime: statsuptime || 0;
        fallbackCache.Active;
        fallbackCache.Stats: fallback.Stats;
        last.Check: new Date();
        details: {
          connection.Pool: {
            size: parse.Int(process.envREDIS_POOL_SIZ.E || '5', 10);
            active: statsconnected;
          };
          read.Replicas: {
            count: 0, // Will be updated when read replicas are configured;
            healthy: 0;
          };
          cluster.Mode: process.envREDIS_CLUSTER_MOD.E === 'true';
          errors;
          warnings;
        }}// Cache the health status;
      thislastHealth.Check = health.Status// Log health status;
      const duration = performancenow() - start.Time;
      loggerinfo('Redis health check completed', LogContextCACH.E, {
        status: health.Statusstatus;
        duration: `${durationto.Fixed(2)}ms`;
        connected: health.Statusconnected;
        latency: health.Statuslatency});
      return health.Status} catch (error) {
      const error.Message = error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error);
      errorspush(error.Message);
      const health.Status: RedisHealth.Status = {
        status: 'unhealthy';
        connected: false;
        latency: -1;
        memory.Usage: 'unknown';
        connected.Clients: 0;
        uptime: 0;
        fallbackCache.Active: true;
        last.Check: new Date();
        details: {
          connection.Pool: {
            size: parse.Int(process.envREDIS_POOL_SIZ.E || '5', 10);
            active: false;
          };
          read.Replicas: {
            count: 0;
            healthy: 0;
          };
          cluster.Mode: false;
          errors;
          warnings;
        }};
      thislastHealth.Check = health.Status;
      return health.Status}}/**
   * Get the last health check result*/
  getLastHealth.Check(): RedisHealth.Status | null {
    return thislastHealth.Check}/**
   * Get health status summary for monitoring*/
  getHealth.Summary(): {
    status: string;
    message: string;
    metrics: Record<string, unknown>} {
    const health = thislastHealth.Check;
    if (!health) {
      return {
        status: 'unknown';
        message: 'No health check performed yet';
        metrics: {
}}};

    let message = 'Redis is operating normally';
    if (healthstatus === 'degraded') {
      message = 'Redis is experiencing issues'} else if (healthstatus === 'unhealthy') {
      message = 'Redis is unavailable'};

    return {
      status: healthstatus;
      message;
      metrics: {
        connected: healthconnected;
        latency_ms: healthlatency;
        memory_usage: healthmemory.Usage;
        connected_clients: healthconnected.Clients;
        uptime_seconds: healthuptime;
        fallback_cache_active: healthfallbackCache.Active;
        fallback_cache_items: healthfallbackCache.Stats?item.Count || 0;
        errors_count: healthdetailserrorslength;
        warnings_count: healthdetailswarningslength;
        last_check: healthlastChecktoISO.String();
      }}}/**
   * Test Redis operations*/
  async testRedis.Operations(): Promise<{
    passed: boolean;
    results: Array<{
      operation: string;
      success: boolean;
      duration: number;
      error instanceof Error ? errormessage : String(error)  string}>}> {
    const results: Array<{
      operation: string;
      success: boolean;
      duration: number;
      error instanceof Error ? errormessage : String(error)  string}> = [];
    const redis.Service = getRedis.Service();
    const test.Key = `health:test:${Date.now()}`;
    const test.Value = JSO.N.stringify({
      test: true;
      timestamp: new Date()toISO.String()})// Test SE.T operation;
    const set.Start = performancenow();
    try {
      await redis.Serviceset(test.Key, test.Value, 60);
      resultspush({
        operation: 'SE.T';
        success: true;
        duration: performancenow() - set.Start})} catch (error) {
      resultspush({
        operation: 'SE.T';
        success: false;
        duration: performancenow() - set.Start;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})}// Test GE.T operation;
    const get.Start = performancenow();
    try {
      const retrieved = await redis.Serviceget(test.Key);
      const success = retrieved === test.Value;
      resultspush({
        operation: 'GE.T';
        success;
        duration: performancenow() - get.Start;
        error instanceof Error ? errormessage : String(error) success ? undefined : 'Value mismatch'})} catch (error) {
      resultspush({
        operation: 'GE.T';
        success: false;
        duration: performancenow() - get.Start;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})}// Test EXIST.S operation;
    const exists.Start = performancenow();
    try {
      const exists = await redis.Serviceexists(test.Key);
      resultspush({
        operation: 'EXIST.S';
        success: exists === 1;
        duration: performancenow() - exists.Start})} catch (error) {
      resultspush({
        operation: 'EXIST.S';
        success: false;
        duration: performancenow() - exists.Start;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})}// Test DE.L operation;
    const del.Start = performancenow();
    try {
      await redis.Servicedel(test.Key);
      resultspush({
        operation: 'DE.L';
        success: true;
        duration: performancenow() - del.Start})} catch (error) {
      resultspush({
        operation: 'DE.L';
        success: false;
        duration: performancenow() - del.Start;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})};

    const passed = resultsevery((r) => rsuccess);
    loggerinfo('Redis operations test completed', LogContextCACH.E, {
      passed;
      total.Operations: resultslength;
      successful.Operations: resultsfilter((r) => rsuccess)length});
    return { passed, results }}}// Export singleton instance;
export const redisHealth.Check = RedisHealthCheckServiceget.Instance();
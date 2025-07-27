import { Supabase.Client, create.Client } from '@supabase/supabase-js';
import type { RedisClient.Type } from 'redis';
import { create.Client as createRedis.Client } from 'redis';
import { logger } from './utils/logger';
import type { ConnectionPool.Config } from './config/resources';
import { getResource.Config } from './config/resources';
import { Event.Emitter } from 'events';
import type Circuit.Breaker from 'opossum';
export interface Connection.Metrics {
  active: number;
  idle: number;
  waiting: number;
  created: number;
  destroyed: number;
  errors: number;
  avgWait.Time: number;
  avgActive.Time: number;
};

export interface Pooled.Connection<T> {
  id: string;
  connection: T;
  created.At: Date;
  lastUsed.At: Date;
  use.Count: number;
  errors: number;
  in.Use: boolean;
};

export class ConnectionPool.Manager extends Event.Emitter {
  private static instance: ConnectionPool.Manager;
  private config: ConnectionPool.Config// Supabase pools;
  private supabase.Pools: Map<string, Pooled.Connection<Supabase.Client>[]> = new Map();
  private supabaseWait.Queue: Map<string, Array<(conn: Supabase.Client) => void>> = new Map()// Redis pools;
  private redis.Pools: Map<string, Pooled.Connection<RedisClient.Type>[]> = new Map();
  private redisWait.Queue: Map<string, Array<(conn: RedisClient.Type) => void>> = new Map()// Metrics;
  private metrics: Map<string, Connection.Metrics> = new Map();
  private metrics.Interval?: NodeJS.Timeout// Circuit breakers;
  private circuit.Breakers: Map<string, Circuit.Breaker> = new Map();
  private constructor() {
    super();
    thisconfig = getResource.Config()connection.Pools;
    thisinitialize()};

  public static get.Instance(): ConnectionPool.Manager {
    if (!ConnectionPool.Managerinstance) {
      ConnectionPool.Managerinstance = new ConnectionPool.Manager()};
    return ConnectionPool.Managerinstance};

  private initialize() {
    // Start metrics collection;
    thismetrics.Interval = set.Interval(() => {
      thiscollect.Metrics()}, 30000)// Every 30 seconds// Handle process exit;
    processon('before.Exit', () => thisshutdown());
    processon('SIGIN.T', () => thisshutdown());
    processon('SIGTER.M', () => thisshutdown())}// Supabase connection management;
  public async getSupabase.Connection(
    pool.Name = 'default';
    url?: string;
    key?: string): Promise<Supabase.Client> {
    const pool = thissupabase.Poolsget(pool.Name) || []// Try to find an idle connection;
    const idle.Conn = poolfind((conn) => !connin.Use);
    if (idle.Conn) {
      idleConnin.Use = true;
      idleConnlastUsed.At = new Date();
      idleConnuse.Count++
      thisupdate.Metrics(pool.Name, 'supabase', 'acquire');
      return idle.Connconnection}// Check if we can create a new connection;
    if (poollength < thisconfigdatabasemax) {
      try {
        const new.Conn = await thiscreateSupabase.Connection(pool.Name, url, key);
        return new.Conn} catch (error) {
        loggererror`Failed to create Supabase connection for pool ${pool.Name}:`, error instanceof Error ? errormessage : String(error);
        throw error instanceof Error ? errormessage : String(error)}}// Wait for a connection to become available;
    return thiswaitForSupabase.Connection(pool.Name)};

  private async createSupabase.Connection(
    pool.Name: string;
    url?: string;
    key?: string): Promise<Supabase.Client> {
    const supabase.Url = url || process.envSUPABASE_UR.L;
    const supabase.Key = key || process.envSUPABASE_ANON_KE.Y;
    if (!supabase.Url || !supabase.Key) {
      throw new Error('Supabase UR.L and key are required')};

    const client = create.Client(supabase.Url, supabase.Key, {
      auth: {
        persist.Session: false;
        autoRefresh.Token: true;
      };
      db: {
        schema: 'public';
      }});
    const pooled.Conn: Pooled.Connection<Supabase.Client> = {
      id: `${pool.Name}-${Date.now()}-${Mathrandom()}`;
      connection: client;
      created.At: new Date();
      lastUsed.At: new Date();
      use.Count: 1;
      errors: 0;
      in.Use: true;
    };
    const pool = thissupabase.Poolsget(pool.Name) || [];
    poolpush(pooled.Conn);
    thissupabase.Poolsset(pool.Name, pool);
    thisupdate.Metrics(pool.Name, 'supabase', 'create');
    loggerinfo(`Created new Supabase connection for pool ${pool.Name}`);
    return client};

  private async waitForSupabase.Connection(pool.Name: string): Promise<Supabase.Client> {
    return new Promise((resolve, reject) => {
      const queue = thissupabaseWait.Queueget(pool.Name) || [];
      const timeout = set.Timeout(() => {
        const index = queueindex.Of(resolve);
        if (index > -1) {
          queuesplice(index, 1)};
        reject(new Error(`Timeout waiting for Supabase connection in pool ${pool.Name}`))}, thisconfigdatabaseacquireTimeout.Millis);
      queuepush((conn: Supabase.Client) => {
        clear.Timeout(timeout);
        resolve(conn)});
      thissupabaseWait.Queueset(pool.Name, queue);
      thisupdate.Metrics(pool.Name, 'supabase', 'wait')})};

  public releaseSupabase.Connection(pool.Name = 'default', client: Supabase.Client) {
    const pool = thissupabase.Poolsget(pool.Name) || [];
    const pooled.Conn = poolfind((conn) => connconnection === client);
    if (!pooled.Conn) {
      loggerwarn(`Connection not found in pool ${pool.Name}`);
      return};

    pooledConnin.Use = false;
    pooledConnlastUsed.At = new Date()// Check if there are waiting requests;
    const queue = thissupabaseWait.Queueget(pool.Name) || [];
    if (queuelength > 0) {
      const waiter = queueshift();
      if (waiter) {
        pooledConnin.Use = true;
        pooledConnuse.Count++
        waiter(client);
        thisupdate.Metrics(pool.Name, 'supabase', 'reuse')}}// Check connection health and recycle if needed;
    thischeckConnection.Health(pool.Name, pooled.Conn)}// Redis connection management;
  public async getRedis.Connection(pool.Name = 'default'): Promise<RedisClient.Type> {
    const pool = thisredis.Poolsget(pool.Name) || []// Try to find an idle connection;
    const idle.Conn = poolfind((conn) => !connin.Use);
    if (idle.Conn) {
      idleConnin.Use = true;
      idleConnlastUsed.At = new Date();
      idleConnuse.Count++
      thisupdate.Metrics(pool.Name, 'redis', 'acquire');
      return idle.Connconnection}// Check if we can create a new connection;
    if (poollength < thisconfigredismax) {
      try {
        const new.Conn = await thiscreateRedis.Connection(pool.Name);
        return new.Conn} catch (error) {
        loggererror`Failed to create Redis connection for pool ${pool.Name}:`, error instanceof Error ? errormessage : String(error);
        throw error instanceof Error ? errormessage : String(error)}}// Wait for a connection to become available;
    return thiswaitForRedis.Connection(pool.Name)};

  private async createRedis.Connection(pool.Name: string): Promise<RedisClient.Type> {
    const redis.Url = process.envREDIS_UR.L || 'redis://localhost:6379';
    const client = createRedis.Client({
      url: redis.Url;
      socket: {
        connect.Timeout: thisconfigredisacquireTimeout.Millis;
        reconnect.Strategy: (retries) => {
          if (retries > thisconfigredisretry.Strategytimes) {
            return new Error('Redis connection retry limit exceeded')};
          return thisconfigredisretry.Strategyinterval * retries}}}) as RedisClient.Type;
    await clientconnect();
    const pooled.Conn: Pooled.Connection<RedisClient.Type> = {
      id: `${pool.Name}-${Date.now()}-${Mathrandom()}`;
      connection: client;
      created.At: new Date();
      lastUsed.At: new Date();
      use.Count: 1;
      errors: 0;
      in.Use: true;
    };
    const pool = thisredis.Poolsget(pool.Name) || [];
    poolpush(pooled.Conn);
    thisredis.Poolsset(pool.Name, pool);
    thisupdate.Metrics(pool.Name, 'redis', 'create');
    loggerinfo(`Created new Redis connection for pool ${pool.Name}`)// Set up errorhandlers;
    clienton('error instanceof Error ? errormessage : String(error)  (err) => {
      loggererror`Redis connection errorin pool ${pool.Name}:`, err);
      pooled.Connerrors++
      thisupdate.Metrics(pool.Name, 'redis', 'error instanceof Error ? errormessage : String(error)});
    return client};

  private async waitForRedis.Connection(pool.Name: string): Promise<RedisClient.Type> {
    return new Promise((resolve, reject) => {
      const queue = thisredisWait.Queueget(pool.Name) || [];
      const timeout = set.Timeout(() => {
        const index = queueindex.Of(resolve);
        if (index > -1) {
          queuesplice(index, 1)};
        reject(new Error(`Timeout waiting for Redis connection in pool ${pool.Name}`))}, thisconfigredisacquireTimeout.Millis);
      queuepush((conn: RedisClient.Type) => {
        clear.Timeout(timeout);
        resolve(conn)});
      thisredisWait.Queueset(pool.Name, queue);
      thisupdate.Metrics(pool.Name, 'redis', 'wait')})};

  public releaseRedis.Connection(pool.Name = 'default', client: RedisClient.Type) {
    const pool = thisredis.Poolsget(pool.Name) || [];
    const pooled.Conn = poolfind((conn) => connconnection === client);
    if (!pooled.Conn) {
      loggerwarn(`Redis connection not found in pool ${pool.Name}`);
      return};

    pooledConnin.Use = false;
    pooledConnlastUsed.At = new Date()// Check if there are waiting requests;
    const queue = thisredisWait.Queueget(pool.Name) || [];
    if (queuelength > 0) {
      const waiter = queueshift();
      if (waiter) {
        pooledConnin.Use = true;
        pooledConnuse.Count++
        waiter(client);
        thisupdate.Metrics(pool.Name, 'redis', 'reuse')}}// Check connection health and recycle if needed;
    thischeckConnection.Health(pool.Name, pooled.Conn)}// Connection health and recycling;
  private async checkConnection.Health<T>(pool.Name: string, pooled.Conn: Pooled.Connection<T>) {
    const now = Date.now();
    const age = now - pooledConncreatedAtget.Time();
    const idle.Time = now - pooledConnlastUsedAtget.Time()// Recycle connections based on age, idle time, or errorcount;
    const should.Recycle =
      age > 3600000 || // 1 hour;
      idle.Time > thisconfigdatabaseidleTimeout.Millis || pooled.Connerrors > 5 || pooledConnuse.Count > 1000;
    if (should.Recycle) {
      await thisrecycle.Connection(pool.Name, pooled.Conn)}};

  private async recycle.Connection<T>(pool.Name: string, pooled.Conn: Pooled.Connection<T>) {
    loggerinfo(`Recycling connection ${pooled.Connid} in pool ${pool.Name}`)// Remove from pool;
    if (pooled.Connconnection instanceof Supabase.Client) {
      const pool = thissupabase.Poolsget(pool.Name) || [];
      const index = poolindex.Of(pooled.Conn as Pooled.Connection<Supabase.Client>);
      if (index > -1) {
        poolsplice(index, 1);
        thissupabase.Poolsset(pool.Name, pool)}} else {
      const pool = thisredis.Poolsget(pool.Name) || [];
      const index = poolindex.Of(pooled.Conn as Pooled.Connection<RedisClient.Type>);
      if (index > -1) {
        poolsplice(index, 1);
        thisredis.Poolsset(pool.Name, pool)// Close Redis connection;
        try {
          await (pooled.Connconnection as RedisClient.Type)quit()} catch (error) {
          loggererror`Error closing Redis connection:`, error instanceof Error ? errormessage : String(error)  }}};

    thisupdate.Metrics(pool.Name, 'unknown', 'destroy')}// Metrics and monitoring;
  private update.Metrics(
    pool.Name: string;
    type: 'supabase' | 'redis' | 'unknown';
    action: 'create' | 'acquire' | 'release' | 'wait' | 'reuse' | 'destroy' | 'error) {
    const key = `${pool.Name}-${type}`;
    const metrics = thismetricsget(key) || {
      active: 0;
      idle: 0;
      waiting: 0;
      created: 0;
      destroyed: 0;
      errors: 0;
      avgWait.Time: 0;
      avgActive.Time: 0;
    };
    switch (action) {
      case 'create':
        metricscreated++
        metricsactive++
        break;
      case 'acquire':
        metricsactive++
        metricsidle--
        break;
      case 'release':
        metricsactive--
        metricsidle++
        break;
      case 'wait':
        metricswaiting++
        break;
      case 'reuse':
        metricswaiting--
        break;
      case 'destroy':
        metricsdestroyed++
        if (metricsidle > 0) metricsidle--
        break;
      case 'error instanceof Error ? errormessage : String(error);
        metricserrors++
        break};

    thismetricsset(key, metrics);
    thisemit('metrics', { pool.Name, type, action, metrics })};

  private collect.Metrics() {
    const report: any = {
      timestamp: new Date()toISO.String();
      pools: {
}}// Collect Supabase metrics;
    thissupabasePoolsfor.Each((pool, pool.Name) => {
      const active = poolfilter((conn) => connin.Use)length;
      const idle = poolfilter((conn) => !connin.Use)length;
      const wait.Queue = thissupabaseWait.Queueget(pool.Name) || [];
      reportpools[`${pool.Name}-supabase`] = {
        total: poollength;
        active;
        idle;
        waiting: wait.Queuelength;
        utilization: poollength > 0 ? (active / poollength) * 100 : 0;
      }})// Collect Redis metrics;
    thisredisPoolsfor.Each((pool, pool.Name) => {
      const active = poolfilter((conn) => connin.Use)length;
      const idle = poolfilter((conn) => !connin.Use)length;
      const wait.Queue = thisredisWait.Queueget(pool.Name) || [];
      reportpools[`${pool.Name}-redis`] = {
        total: poollength;
        active;
        idle;
        waiting: wait.Queuelength;
        utilization: poollength > 0 ? (active / poollength) * 100 : 0;
      }});
    loggerinfo('Connection pool metrics:', report);
    thisemit('metrics-report', report)};

  public get.Metrics(): Map<string, Connection.Metrics> {
    return new Map(thismetrics)};

  public getPool.Status(pool.Name = 'default'): any {
    const supabase.Pool = thissupabase.Poolsget(pool.Name) || [];
    const redis.Pool = thisredis.Poolsget(pool.Name) || [];
    return {
      supabase: {
        total: supabase.Poollength;
        active: supabase.Poolfilter((conn) => connin.Use)length;
        idle: supabase.Poolfilter((conn) => !connin.Use)length;
        waiting: (thissupabaseWait.Queueget(pool.Name) || [])length;
        connections: supabase.Poolmap((conn) => ({
          id: connid;
          in.Use: connin.Use;
          created.At: conncreated.At;
          lastUsed.At: connlastUsed.At;
          use.Count: connuse.Count;
          errors: connerrors}))};
      redis: {
        total: redis.Poollength;
        active: redis.Poolfilter((conn) => connin.Use)length;
        idle: redis.Poolfilter((conn) => !connin.Use)length;
        waiting: (thisredisWait.Queueget(pool.Name) || [])length;
        connections: redis.Poolmap((conn) => ({
          id: connid;
          in.Use: connin.Use;
          created.At: conncreated.At;
          lastUsed.At: connlastUsed.At;
          use.Count: connuse.Count;
          errors: connerrors}))}}}// Graceful shutdown;
  public async shutdown() {
    loggerinfo('Shutting down connection pool manager.');
    if (thismetrics.Interval) {
      clear.Interval(thismetrics.Interval)}// Close all Supabase connections;
    for (const [pool.Name, pool] of thissupabase.Pools) {
      loggerinfo(`Closing ${poollength} Supabase connections in pool ${pool.Name}`)// Supabase clients don't need explicit closing;
      poollength = 0}// Close all Redis connections;
    for (const [pool.Name, pool] of thisredis.Pools) {
      loggerinfo(`Closing ${poollength} Redis connections in pool ${pool.Name}`);
      for (const conn of pool) {
        try {
          await connconnectionquit()} catch (error) {
          loggererror`Error closing Redis connection:`, error instanceof Error ? errormessage : String(error)  }};
      poollength = 0};

    thisremoveAll.Listeners();
    loggerinfo('Connection pool manager shutdown complete')}}// Export singleton instance;
export const connectionPool.Manager = ConnectionPoolManagerget.Instance();
import { Supabase.Client, create.Client } from '@supabase/supabase-js';
import type { Redis.Client.Type } from 'redis';
import { create.Client.as create.Redis.Client } from 'redis';
import { logger } from './utils/logger';
import type { Connection.Pool.Config } from './config/resources';
import { get.Resource.Config } from './config/resources';
import { Event.Emitter } from 'events';
import type Circuit.Breaker.from 'opossum';
export interface Connection.Metrics {
  active: number,
  idle: number,
  waiting: number,
  created: number,
  destroyed: number,
  errors: number,
  avg.Wait.Time: number,
  avg.Active.Time: number,
}
export interface Pooled.Connection<T> {
  id: string,
  connection: T,
  created.At: Date,
  last.Used.At: Date,
  use.Count: number,
  errors: number,
  in.Use: boolean,
}
export class Connection.Pool.Manager.extends Event.Emitter {
  private static instance: Connection.Pool.Manager,
  private config: Connection.Pool.Config// Supabase pools,
  private supabase.Pools: Map<string, Pooled.Connection<Supabase.Client>[]> = new Map();
  private supabase.Wait.Queue: Map<string, Array<(conn: Supabase.Client) => void>> = new Map()// Redis pools,
  private redis.Pools: Map<string, Pooled.Connection<Redis.Client.Type>[]> = new Map();
  private redis.Wait.Queue: Map<string, Array<(conn: Redis.Client.Type) => void>> = new Map()// Metrics,
  private metrics: Map<string, Connection.Metrics> = new Map();
  private metrics.Interval?: NodeJ.S.Timeout// Circuit breakers;
  private circuit.Breakers: Map<string, Circuit.Breaker> = new Map();
  private constructor() {
    super();
    thisconfig = get.Resource.Config()connection.Pools;
    thisinitialize();

  public static get.Instance(): Connection.Pool.Manager {
    if (!Connection.Pool.Managerinstance) {
      Connection.Pool.Managerinstance = new Connection.Pool.Manager();
    return Connection.Pool.Managerinstance;

  private initialize() {
    // Start metrics collection;
    this.metrics.Interval = set.Interval(() => {
      thiscollect.Metrics()}, 30000)// Every 30 seconds// Handle process exit;
    process.on('before.Exit', () => thisshutdown());
    process.on('SIGI.N.T', () => thisshutdown());
    process.on('SIGTE.R.M', () => thisshutdown())}// Supabase connection management;
  public async get.Supabase.Connection(
    pool.Name = 'default';
    url?: string;
    key?: string): Promise<Supabase.Client> {
    const pool = thissupabase.Poolsget(pool.Name) || []// Try to find an idle connection;
    const idle.Conn = poolfind((conn) => !connin.Use);
    if (idle.Conn) {
      idle.Connin.Use = true;
      idleConnlast.Used.At = new Date();
      idle.Connuse.Count++
      thisupdate.Metrics(pool.Name, 'supabase', 'acquire');
      return idle.Connconnection}// Check if we can create a new connection;
    if (poollength < thisconfigdatabasemax) {
      try {
        const new.Conn = await thiscreate.Supabase.Connection(pool.Name, url, key);
        return new.Conn} catch (error) {
        loggererror`Failed to create Supabase connection for pool ${pool.Name}:`, error instanceof Error ? error.message : String(error);
        throw error instanceof Error ? error.message : String(error)}}// Wait for a connection to become available;
    return thiswaitFor.Supabase.Connection(pool.Name);

  private async create.Supabase.Connection(
    pool.Name: string,
    url?: string;
    key?: string): Promise<Supabase.Client> {
    const supabase.Url = url || process.envSUPABASE_U.R.L;
    const supabase.Key = key || process.envSUPABASE_ANON_K.E.Y;
    if (!supabase.Url || !supabase.Key) {
      throw new Error('Supabase U.R.L.and key are required');

    const client = create.Client(supabase.Url, supabase.Key, {
      auth: {
        persist.Session: false,
        auto.Refresh.Token: true,
}      db: {
        schema: 'public',
      }});
    const pooled.Conn: Pooled.Connection<Supabase.Client> = {
      id: `${pool.Name}-${Date.now()}-${Mathrandom()}`,
      connection: client,
      created.At: new Date(),
      last.Used.At: new Date(),
      use.Count: 1,
      errors: 0,
      in.Use: true,
}    const pool = thissupabase.Poolsget(pool.Name) || [];
    poolpush(pooled.Conn);
    thissupabase.Poolsset(pool.Name, pool);
    thisupdate.Metrics(pool.Name, 'supabase', 'create');
    loggerinfo(`Created new Supabase connection for pool ${pool.Name}`);
    return client;

  private async waitFor.Supabase.Connection(pool.Name: string): Promise<Supabase.Client> {
    return new Promise((resolve, reject) => {
      const queue = thissupabase.Wait.Queueget(pool.Name) || [];
      const timeout = set.Timeout(() => {
        const index = queueindex.Of(resolve);
        if (index > -1) {
          queuesplice(index, 1);
        reject(new Error(`Timeout waiting for Supabase connection in pool ${pool.Name}`))}, thisconfigdatabaseacquire.Timeout.Millis);
      queuepush((conn: Supabase.Client) => {
        clear.Timeout(timeout);
        resolve(conn)});
      thissupabase.Wait.Queueset(pool.Name, queue);
      thisupdate.Metrics(pool.Name, 'supabase', 'wait')});

  public release.Supabase.Connection(pool.Name = 'default', client: Supabase.Client) {
    const pool = thissupabase.Poolsget(pool.Name) || [];
    const pooled.Conn = poolfind((conn) => connconnection === client);
    if (!pooled.Conn) {
      loggerwarn(`Connection not found in pool ${pool.Name}`);
      return;

    pooled.Connin.Use = false;
    pooledConnlast.Used.At = new Date()// Check if there are waiting requests;
    const queue = thissupabase.Wait.Queueget(pool.Name) || [];
    if (queuelength > 0) {
      const waiter = queueshift();
      if (waiter) {
        pooled.Connin.Use = true;
        pooled.Connuse.Count++
        waiter(client);
        thisupdate.Metrics(pool.Name, 'supabase', 'reuse')}}// Check connection health and recycle if needed;
    thischeck.Connection.Health(pool.Name, pooled.Conn)}// Redis connection management;
  public async get.Redis.Connection(pool.Name = 'default'): Promise<Redis.Client.Type> {
    const pool = thisredis.Poolsget(pool.Name) || []// Try to find an idle connection;
    const idle.Conn = poolfind((conn) => !connin.Use);
    if (idle.Conn) {
      idle.Connin.Use = true;
      idleConnlast.Used.At = new Date();
      idle.Connuse.Count++
      thisupdate.Metrics(pool.Name, 'redis', 'acquire');
      return idle.Connconnection}// Check if we can create a new connection;
    if (poollength < thisconfigredismax) {
      try {
        const new.Conn = await thiscreate.Redis.Connection(pool.Name);
        return new.Conn} catch (error) {
        loggererror`Failed to create Redis connection for pool ${pool.Name}:`, error instanceof Error ? error.message : String(error);
        throw error instanceof Error ? error.message : String(error)}}// Wait for a connection to become available;
    return thiswaitFor.Redis.Connection(pool.Name);

  private async create.Redis.Connection(pool.Name: string): Promise<Redis.Client.Type> {
    const redis.Url = process.envREDIS_U.R.L || 'redis://localhost:6379';
    const client = create.Redis.Client({
      url: redis.Url,
      socket: {
        connect.Timeout: thisconfigredisacquire.Timeout.Millis,
        reconnect.Strategy: (retries) => {
          if (retries > thisconfigredisretry.Strategytimes) {
            return new Error('Redis connection retry limit exceeded');
          return thisconfigredisretry.Strategyinterval * retries}}}) as Redis.Client.Type;
    await clientconnect();
    const pooled.Conn: Pooled.Connection<Redis.Client.Type> = {
      id: `${pool.Name}-${Date.now()}-${Mathrandom()}`,
      connection: client,
      created.At: new Date(),
      last.Used.At: new Date(),
      use.Count: 1,
      errors: 0,
      in.Use: true,
}    const pool = thisredis.Poolsget(pool.Name) || [];
    poolpush(pooled.Conn);
    thisredis.Poolsset(pool.Name, pool);
    thisupdate.Metrics(pool.Name, 'redis', 'create');
    loggerinfo(`Created new Redis connection for pool ${pool.Name}`)// Set up errorhandlers;
    clienton('error instanceof Error ? error.message : String(error)  (err) => {
      loggererror`Redis connection errorin pool ${pool.Name}:`, err);
      pooled.Connerrors++
      thisupdate.Metrics(pool.Name, 'redis', 'error instanceof Error ? error.message : String(error)});
    return client;

  private async waitFor.Redis.Connection(pool.Name: string): Promise<Redis.Client.Type> {
    return new Promise((resolve, reject) => {
      const queue = thisredis.Wait.Queueget(pool.Name) || [];
      const timeout = set.Timeout(() => {
        const index = queueindex.Of(resolve);
        if (index > -1) {
          queuesplice(index, 1);
        reject(new Error(`Timeout waiting for Redis connection in pool ${pool.Name}`))}, thisconfigredisacquire.Timeout.Millis);
      queuepush((conn: Redis.Client.Type) => {
        clear.Timeout(timeout);
        resolve(conn)});
      thisredis.Wait.Queueset(pool.Name, queue);
      thisupdate.Metrics(pool.Name, 'redis', 'wait')});

  public release.Redis.Connection(pool.Name = 'default', client: Redis.Client.Type) {
    const pool = thisredis.Poolsget(pool.Name) || [];
    const pooled.Conn = poolfind((conn) => connconnection === client);
    if (!pooled.Conn) {
      loggerwarn(`Redis connection not found in pool ${pool.Name}`);
      return;

    pooled.Connin.Use = false;
    pooledConnlast.Used.At = new Date()// Check if there are waiting requests;
    const queue = thisredis.Wait.Queueget(pool.Name) || [];
    if (queuelength > 0) {
      const waiter = queueshift();
      if (waiter) {
        pooled.Connin.Use = true;
        pooled.Connuse.Count++
        waiter(client);
        thisupdate.Metrics(pool.Name, 'redis', 'reuse')}}// Check connection health and recycle if needed;
    thischeck.Connection.Health(pool.Name, pooled.Conn)}// Connection health and recycling;
  private async check.Connection.Health<T>(pool.Name: string, pooled.Conn: Pooled.Connection<T>) {
    const now = Date.now();
    const age = now - pooledConncreated.Atget.Time();
    const idle.Time = now - pooledConnlastUsed.Atget.Time()// Recycle connections based on age, idle time, or errorcount;
    const should.Recycle =
      age > 3600000 || // 1 hour;
      idle.Time > thisconfigdatabaseidle.Timeout.Millis || pooled.Connerrors > 5 || pooled.Connuse.Count > 1000;
    if (should.Recycle) {
      await thisrecycle.Connection(pool.Name, pooled.Conn)};

  private async recycle.Connection<T>(pool.Name: string, pooled.Conn: Pooled.Connection<T>) {
    loggerinfo(`Recycling connection ${pooled.Connid} in pool ${pool.Name}`)// Remove from pool;
    if (pooled.Connconnection.instanceof Supabase.Client) {
      const pool = thissupabase.Poolsget(pool.Name) || [];
      const index = poolindex.Of(pooled.Conn.as Pooled.Connection<Supabase.Client>);
      if (index > -1) {
        poolsplice(index, 1);
        thissupabase.Poolsset(pool.Name, pool)}} else {
      const pool = thisredis.Poolsget(pool.Name) || [];
      const index = poolindex.Of(pooled.Conn.as Pooled.Connection<Redis.Client.Type>);
      if (index > -1) {
        poolsplice(index, 1);
        thisredis.Poolsset(pool.Name, pool)// Close Redis connection;
        try {
          await (pooled.Connconnection.as Redis.Client.Type)quit()} catch (error) {
          loggererror`Error closing Redis connection:`, error instanceof Error ? error.message : String(error)  }};

    thisupdate.Metrics(pool.Name, 'unknown', 'destroy')}// Metrics and monitoring;
  private update.Metrics(
    pool.Name: string,
    type: 'supabase' | 'redis' | 'unknown',
    action: 'create' | 'acquire' | 'release' | 'wait' | 'reuse' | 'destroy' | 'error) {
    const key = `${pool.Name}-${type}`;
    const metrics = this.metricsget(key) || {
      active: 0,
      idle: 0,
      waiting: 0,
      created: 0,
      destroyed: 0,
      errors: 0,
      avg.Wait.Time: 0,
      avg.Active.Time: 0,
}    switch (action) {
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
      case 'error instanceof Error ? error.message : String(error);
        metricserrors++
        break;

    this.metricsset(key, metrics);
    thisemit('metrics', { pool.Name, type, action, metrics });

  private collect.Metrics() {
    const report: any = {
      timestamp: new Date()toIS.O.String(),
      pools: {
}}// Collect Supabase metrics;
    thissupabase.Poolsfor.Each((pool, pool.Name) => {
      const active = poolfilter((conn) => connin.Use)length;
      const idle = poolfilter((conn) => !connin.Use)length;
      const wait.Queue = thissupabase.Wait.Queueget(pool.Name) || [];
      reportpools[`${pool.Name}-supabase`] = {
        total: poollength,
        active;
        idle;
        waiting: wait.Queuelength,
        utilization: poollength > 0 ? (active / poollength) * 100 : 0,
      }})// Collect Redis metrics;
    thisredis.Poolsfor.Each((pool, pool.Name) => {
      const active = poolfilter((conn) => connin.Use)length;
      const idle = poolfilter((conn) => !connin.Use)length;
      const wait.Queue = thisredis.Wait.Queueget(pool.Name) || [];
      reportpools[`${pool.Name}-redis`] = {
        total: poollength,
        active;
        idle;
        waiting: wait.Queuelength,
        utilization: poollength > 0 ? (active / poollength) * 100 : 0,
      }});
    loggerinfo('Connection pool metrics:', report);
    thisemit('metrics-report', report);

  public get.Metrics(): Map<string, Connection.Metrics> {
    return new Map(this.metrics);

  public get.Pool.Status(pool.Name = 'default'): any {
    const supabase.Pool = thissupabase.Poolsget(pool.Name) || [];
    const redis.Pool = thisredis.Poolsget(pool.Name) || [];
    return {
      supabase: {
        total: supabase.Poollength,
        active: supabase.Poolfilter((conn) => connin.Use)length,
        idle: supabase.Poolfilter((conn) => !connin.Use)length,
        waiting: (thissupabase.Wait.Queueget(pool.Name) || [])length,
        connections: supabase.Poolmap((conn) => ({
          id: connid,
          in.Use: connin.Use,
          created.At: conncreated.At,
          last.Used.At: connlast.Used.At,
          use.Count: connuse.Count,
          errors: connerrors})),
      redis: {
        total: redis.Poollength,
        active: redis.Poolfilter((conn) => connin.Use)length,
        idle: redis.Poolfilter((conn) => !connin.Use)length,
        waiting: (thisredis.Wait.Queueget(pool.Name) || [])length,
        connections: redis.Poolmap((conn) => ({
          id: connid,
          in.Use: connin.Use,
          created.At: conncreated.At,
          last.Used.At: connlast.Used.At,
          use.Count: connuse.Count,
          errors: connerrors}))}}}// Graceful shutdown,
  public async shutdown() {
    loggerinfo('Shutting down connection pool manager.');
    if (this.metrics.Interval) {
      clear.Interval(this.metrics.Interval)}// Close all Supabase connections;
    for (const [pool.Name, pool] of thissupabase.Pools) {
      loggerinfo(`Closing ${poollength} Supabase connections in pool ${pool.Name}`)// Supabase clients don't need explicit closing;
      poollength = 0}// Close all Redis connections;
    for (const [pool.Name, pool] of thisredis.Pools) {
      loggerinfo(`Closing ${poollength} Redis connections in pool ${pool.Name}`);
      for (const conn of pool) {
        try {
          await connconnectionquit()} catch (error) {
          loggererror`Error closing Redis connection:`, error instanceof Error ? error.message : String(error)  };
      poollength = 0;

    thisremove.All.Listeners();
    loggerinfo('Connection pool manager shutdown complete')}}// Export singleton instance;
export const connection.Pool.Manager = ConnectionPool.Managerget.Instance();
/**
 * Redis Service - Production-ready Redis connection management* Provides connection pooling, health monitoring, error handling* circuit breaker pattern and in-memory fallback cache*/

import Redis, { Cluster, type Redis.Options } from 'ioredis';
import { Log.Context, logger } from './utils/enhanced-logger';
import config from './config';
import { circuit.Breaker } from './circuit-breaker';
import { LR.U.Cache } from 'lru-cache';
export interface Redis.Config {
  url: string,
  maxRetries.Per.Request?: number;
  retryDelay.On.Failover?: number;
  enable.Auto.Pipelining?: boolean;
  max.Reconnect.Times?: number;
  connect.Timeout?: number;
  command.Timeout?: number;
  enable.Read.Replicas?: boolean;
  cluster.Mode?: boolean;
  pool.Size?: number;
}
interface Cache.Entry {
  value: any,
  ttl?: number;
  created.At: number,
}
export class Redis.Service {
  private static instance: Redis.Service | null = null,
  private client: Redis | null = null,
  private cluster.Client: Cluster | null = null,
  private read.Replicas: Redis[] = [],
  private is.Connected = false;
  private connection.Attempts = 0;
  private readonly max.Connection.Attempts = 5// In-memory fallback cache using L.R.U;
  private fallback.Cache: LR.U.Cache<string, Cache.Entry>
  private readonly fallback.Cache.Options = {
    max: 10000, // Maximum number of items;
    max.Size: 100 * 1024 * 1024, // 100M.B max size;
    size.Calculation: (entry: Cache.Entry) => {
      const str = JS.O.N.stringify(entryvalue);
      return strlength;
    ttl: 1000 * 60 * 5, // 5 minutes default T.T.L;
    updateAge.On.Get: true,
    updateAge.On.Has: true,
  }// Connection pool management;
  private connection.Pool: Redis[] = [],
  private pool.Index = 0;
  constructor(private config: Redis.Config) {
    // Initialize fallback cache;
    thisfallback.Cache = new LR.U.Cache<string, Cache.Entry>(thisfallback.Cache.Options);

  static get.Instance(redis.Config?: Redis.Config): Redis.Service {
    if (!Redis.Serviceinstance) {
      const default.Config: Redis.Config = {
        url: configcache?redis.Url || 'redis://localhost:6379',
        maxRetries.Per.Request: 3,
        retryDelay.On.Failover: 100,
        enable.Auto.Pipelining: true,
        max.Reconnect.Times: 5,
        connect.Timeout: 10000,
        command.Timeout: 5000,
        enable.Read.Replicas: process.envREDIS_READ_REPLIC.A.S === 'true',
        cluster.Mode: process.envREDIS_CLUSTER_MO.D.E === 'true',
        pool.Size: parse.Int(process.envREDIS_POOL_SI.Z.E || '5', 10);
      Redis.Serviceinstance = new Redis.Service(redis.Config || default.Config);
    return Redis.Serviceinstance;

  async connect(): Promise<void> {
    if (thisis.Connected && (thisclient || thiscluster.Client)) {
      return;

    try {
      thisconnection.Attempts++
      loggerinfo('🔗 Connecting to Redis.', LogContextCAC.H.E, {
        cluster.Mode: thisconfigcluster.Mode,
        pool.Size: thisconfigpool.Size}),
      const redis.Options: Redis.Options = {
        maxRetries.Per.Request: thisconfigmaxRetries.Per.Request,
        enable.Auto.Pipelining: thisconfigenable.Auto.Pipelining,
        connect.Timeout: thisconfigconnect.Timeout,
        command.Timeout: thisconfigcommand.Timeout,
        lazy.Connect: true,
        keep.Alive: 30000,
        family: 4,
        retry.Strategy: (times) => {
          if (times > thismax.Connection.Attempts) {
            return null, // Stop retrying;
          return Math.min(times * 100, 3000)};
      if (thisconfigcluster.Mode) {
        // Initialize Redis Cluster;
        const cluster.Nodes = thisparse.Cluster.Nodes(thisconfigurl);
        thiscluster.Client = new Cluster(cluster.Nodes, {
          redis.Options;
          enable.Ready.Check: true,
          max.Redirections: 16,
          retryDelay.On.Failover: thisconfigretryDelay.On.Failover,
          retryDelayOn.Cluster.Down: 300,
          slots.Refresh.Timeout: 2000,
          cluster.Retry.Strategy: (times) => {
            if (times > thismax.Connection.Attempts) {
              return null;
            return Math.min(times * 100, 3000)}})// Set up cluster event listeners;
        thissetupCluster.Event.Listeners();
        await thiscluster.Clientconnect()} else {
        // Initialize single Redis instance or connection pool;
        if (thisconfigpool.Size && thisconfigpool.Size > 1) {
          // Create connection pool;
          for (let i = 0; i < thisconfigpool.Size, i++) {
            const pool.Client = new Redis(thisconfigurl, {
              .redis.Options;
              connection.Name: `pool-${i}`}),
            thissetup.Event.Listeners(pool.Client);
            await pool.Clientconnect();
            thisconnection.Poolpush(pool.Client)}// Use first connection as primary client;
          thisclient = thisconnection.Pool[0]} else {
          // Single connection;
          thisclient = new Redis(thisconfigurl, redis.Options);
          thissetup.Event.Listeners(thisclient);
          await thisclientconnect()}// Initialize read replicas if enabled;
        if (thisconfigenable.Read.Replicas) {
          await this.initialize.Read.Replicas()};

      thisis.Connected = true;
      thisconnection.Attempts = 0;
      loggerinfo('✅ Redis connected successfully', LogContextCAC.H.E, {
        url: thismask.Url(thisconfigurl),
        attempts: thisconnection.Attempts,
        mode: thisconfigcluster.Mode ? 'cluster' : 'standalone',
        pool.Size: thisconnection.Poollength || 1})} catch (error) {
      thisis.Connected = false;
      const error.Message = error instanceof Error ? errormessage : String(error);
      loggererror('❌ Redis connection failed', LogContextCAC.H.E, {
        error instanceof Error ? errormessage : String(error) error.Message;
        attempts: thisconnection.Attempts,
        max.Attempts: thismax.Connection.Attempts}),
      if (thisconnection.Attempts >= thismax.Connection.Attempts) {
        loggerwarn('🔄 Falling back to in-memory cache', LogContextCAC.H.E)// Don't throw - allow fallback to in-memory cache;
        return}// Exponential backoff retry;
      const delay = Math.min(1000 * Mathpow(2, thisconnection.Attempts), 10000);
      await new Promise((resolve) => set.Timeout(resolve, delay));
      return thisconnect()};

  private parse.Cluster.Nodes(url: string): Array<{ host: string, port: number }> {
    // Parse cluster nodes from U.R.L or environment variable;
    const cluster.Urls = process.envREDIS_CLUSTER_NOD.E.S?split(',') || [url];
    return cluster.Urlsmap((node.Url) => {
      const url.Obj = new U.R.L(node.Url);
      return {
        host: url.Objhostname,
        port: parse.Int(url.Objport || '6379', 10)}});

  private async initialize.Read.Replicas(): Promise<void> {
    const replica.Urls = process.envREDIS_READ_REPLICA_UR.L.S?split(',') || [];
    for (const replica.Url of replica.Urls) {
      try {
        const replica = new Redis(replica.Url, {
          enable.Offline.Queue: false,
          connect.Timeout: 5000,
          lazy.Connect: true}),
        await replicaconnect();
        thisread.Replicaspush(replica);
        loggerinfo('✅ Read replica connected', LogContextCAC.H.E, {
          url: thismask.Url(replica.Url)})} catch (error) {
        loggerwarn('⚠️ Read replica connection failed', LogContextCAC.H.E, {
          url: thismask.Url(replica.Url),
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)})}};

  private setup.Event.Listeners(client?: Redis): void {
    const target.Client = client || thisclient;
    if (!target.Client) return;
    target.Clienton('connect', () => {
      loggerinfo('🔗 Redis connection established', LogContextCAC.H.E)});
    target.Clienton('ready', () => {
      if (!client || client === thisclient) {
        thisis.Connected = true;
      loggerinfo('✅ Redis ready for commands', LogContextCAC.H.E)});
    target.Clienton('error', (error) => {
      if (!client || client === thisclient) {
        thisis.Connected = false;
      loggererror('❌ Redis error', LogContextCAC.H.E, {
        error instanceof Error ? errormessage : String(error) errormessage;
        stack: errorstack})}),
    target.Clienton('close', () => {
      if (!client || client === thisclient) {
        thisis.Connected = false;
      loggerwarn('⚠️ Redis connection closed', LogContextCAC.H.E)});
    target.Clienton('reconnecting', (delay: number) => {
      loggerinfo('🔄 Redis reconnecting.', LogContextCAC.H.E, { delay })});
    target.Clienton('end', () => {
      if (!client || client === thisclient) {
        thisis.Connected = false;
      loggerinfo('📪 Redis connection ended', LogContextCAC.H.E)});

  private setupCluster.Event.Listeners(): void {
    if (!thiscluster.Client) return;
    thiscluster.Clienton('connect', () => {
      loggerinfo('🔗 Redis cluster connection established', LogContextCAC.H.E)});
    thiscluster.Clienton('ready', () => {
      thisis.Connected = true;
      loggerinfo('✅ Redis cluster ready for commands', LogContextCAC.H.E)});
    thiscluster.Clienton('error', (error) => {
      thisis.Connected = false;
      loggererror('❌ Redis cluster error', LogContextCAC.H.E, {
        error instanceof Error ? errormessage : String(error) errormessage})});
    thiscluster.Clienton('close', () => {
      thisis.Connected = false;
      loggerwarn('⚠️ Redis cluster connection closed', LogContextCAC.H.E)});
    thiscluster.Clienton('node error', (error instanceof Error ? errormessage : String(error) address) => {
      loggererror('❌ Redis cluster node error', LogContextCAC.H.E, {
        error instanceof Error ? errormessage : String(error) errormessage;
        address})});

  async disconnect(): Promise<void> {
    try {
      // Disconnect connection pool;
      for (const pool.Client of thisconnection.Pool) {
        try {
          await pool.Clientquit()} catch (error) {
          loggererror('❌ Error disconnecting pool client', LogContextCAC.H.E, {
            error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)})};
      thisconnection.Pool = []// Disconnect read replicas;
      for (const replica of thisread.Replicas) {
        try {
          await replicaquit()} catch (error) {
          loggererror('❌ Error disconnecting read replica', LogContextCAC.H.E, {
            error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)})};
      thisread.Replicas = []// Disconnect main client;
      if (thisclient) {
        await thisclientquit()}// Disconnect cluster client;
      if (thiscluster.Client) {
        await thiscluster.Clientquit();

      loggerinfo('👋 Redis disconnected gracefully', LogContextCAC.H.E)} catch (error) {
      loggererror('❌ Error during Redis disconnect', LogContextCAC.H.E, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)})} finally {
      thisclient = null;
      thiscluster.Client = null;
      thisis.Connected = false;
      thispool.Index = 0};

  get.Client(): Redis | Cluster {
    if (thiscluster.Client) {
      return thiscluster.Client;

    if (!thisclient || !thisis.Connected) {
      throw new Error('Redis client not connected. Call connect() first.')}// Return a connection from the pool using round-robin;
    if (thisconnection.Poollength > 1) {
      const client = thisconnection.Pool[thispool.Index];
      thispool.Index = (thispool.Index + 1) % thisconnection.Poollength;
      return client;

    return thisclient;

  private get.Read.Client(): Redis | Cluster {
    // If we have read replicas, use them for read operations;
    if (thisread.Replicaslength > 0) {
      const replica.Index = Mathfloor(Mathrandom() * thisread.Replicaslength);
      return thisread.Replicas[replica.Index]}// Otherwise use the main client;
    return thisget.Client();

  is.Healthy(): boolean {
    return thisis.Connected && thisclient !== null;

  async health.Check(): Promise<{ healthy: boolean; latency?: number, error?: string }> {
    if (!thisclient || !thisis.Connected) {
      return { healthy: false, error instanceof Error ? errormessage : String(error) 'Not connected' };

    try {
      const start = Date.now();
      await thisclientping();
      const latency = Date.now() - start;
      return { healthy: true, latency }} catch (error) {
      return {
        healthy: false,
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error);
      }};

  async get.Stats(): Promise<{
    connected: boolean,
    connection.Attempts: number,
    memory.Usage?: string;
    connected.Clients?: number;
    uptime?: number}> {
    const stats = {
      connected: thisis.Connected,
      connection.Attempts: thisconnection.Attempts,
    if (thisclient && thisis.Connected) {
      try {
        const info = await thisclientinfo('memory');
        const memory.Match = infomatch(/used_memory_human:(\S+)/);
        if (memory.Match) {
          (stats as any)memory.Usage = memory.Match[1];

        const server.Info = await thisclientinfo('server');
        const uptime.Match = server.Infomatch(/uptime_in_seconds:(\d+)/);
        if (uptime.Match) {
          (stats as any)uptime = parse.Int(uptime.Match[1], 10);

        const clients.Info = await thisclientinfo('clients');
        const clients.Match = clients.Infomatch(/connected_clients:(\d+)/);
        if (clients.Match) {
          (stats as any)connected.Clients = parse.Int(clients.Match[1], 10)}} catch (error) {
        loggerwarn('⚠️ Could not fetch Redis stats', LogContextCAC.H.E, {
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)})};

    return stats;

  private mask.Url(url: string): string {
    try {
      const url.Obj = new U.R.L(url);
      if (url.Objpassword) {
        url.Objpassword = '***';
      return url.Objto.String()} catch {
      return urlreplace(/:([^@]+)@/, ':***@')}}// Cache operations with circuit breaker and fallback;

  async get(key: string): Promise<string | null> {
    return circuit.Breakerredis.Operation(
      'get';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected');

        const client = thisget.Read.Client();
        return await clientget(key);
      {
        fallback: () => {
          // Fallback to in-memory cache;
          const cached = thisfallback.Cacheget(key);
          if (cached && thisis.Entry.Valid(cached)) {
            loggerdebug('📦 Serving from fallback cache', LogContextCAC.H.E, { key });
            return cachedvalue;
          return null}});

  async set(key: string, value: string, ttl?: number): Promise<'O.K' | null> {
    return circuit.Breakerredis.Operation(
      'set';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected');

        const client = thisget.Client();
        let result: 'O.K' | null,
        if (ttl) {
          result = await clientsetex(key, ttl, value)} else {
          result = await clientset(key, value)}// Also store in fallback cache;
        thisfallback.Cacheset(key, {
          value;
          ttl;
          created.At: Date.now()}),
        return result;
      {
        fallback: () => {
          // Store only in fallback cache when Redis is down;
          thisfallback.Cacheset(key, {
            value;
            ttl;
            created.At: Date.now()}),
          loggerwarn('⚠️ Stored in fallback cache only', LogContextCAC.H.E, { key });
          return 'O.K'}});

  async del(key: string | string[]): Promise<number> {
    const keys = Array.is.Array(key) ? key : [key];
    return circuit.Breakerredis.Operation(
      'del';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected');

        const client = thisget.Client();
        const result = await clientdel(.keys)// Also remove from fallback cache;
        keysfor.Each((k) => thisfallback.Cachedelete(k));
        return result;
      {
        fallback: () => {
          // Remove only from fallback cache when Redis is down;
          let count = 0;
          keysfor.Each((k) => {
            if (thisfallback.Cachedelete(k)) {
              count++}});
          return count}});

  async mget(keys: string[]): Promise<(string | null)[]> {
    return circuit.Breakerredis.Operation(
      'mget';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected');

        const client = thisget.Read.Client();
        return await clientmget(.keys);
      {
        fallback: () => {
          // Get from fallback cache;
          return keysmap((key) => {
            const cached = thisfallback.Cacheget(key);
            if (cached && thisis.Entry.Valid(cached)) {
              return cachedvalue;
            return null})}});

  async mset(key.Values: Record<string, string>): Promise<'O.K'> {
    return circuit.Breakerredis.Operation(
      'mset';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected');

        const client = thisget.Client();
        const args: string[] = [],
        Objectentries(key.Values)for.Each(([key, value]) => {
          argspush(key, value)// Also store in fallback cache;
          thisfallback.Cacheset(key, {
            value;
            created.At: Date.now()})}),
        return await clientmset(.args);
      {
        fallback: () => {
          // Store only in fallback cache when Redis is down;
          Objectentries(key.Values)for.Each(([key, value]) => {
            thisfallback.Cacheset(key, {
              value;
              created.At: Date.now()})}),
          return 'O.K'}});

  async exists(key: string | string[]): Promise<number> {
    const keys = Array.is.Array(key) ? key : [key];
    return circuit.Breakerredis.Operation(
      'exists';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected');

        const client = thisget.Read.Client();
        return await clientexists(.keys);
      {
        fallback: () => {
          // Check in fallback cache;
          let count = 0;
          keysfor.Each((k) => {
            if (thisfallback.Cachehas(k)) {
              const entry = thisfallback.Cacheget(k);
              if (entry && thisis.Entry.Valid(entry)) {
                count++}}});
          return count}});

  async expire(key: string, ttl: number): Promise<number> {
    return circuit.Breakerredis.Operation(
      'expire';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected');

        const client = thisget.Client();
        const result = await clientexpire(key, ttl)// Update T.T.L in fallback cache;
        const cached = thisfallback.Cacheget(key);
        if (cached) {
          cachedttl = ttl;
          thisfallback.Cacheset(key, cached);
}        return result;
      {
        fallback: () => {
          // Update T.T.L only in fallback cache;
          const cached = thisfallback.Cacheget(key);
          if (cached) {
            cachedttl = ttl;
            thisfallback.Cacheset(key, cached);
            return 1;
          return 0}});

  async ttl(key: string): Promise<number> {
    return circuit.Breakerredis.Operation(
      'ttl';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected');

        const client = thisget.Read.Client();
        return await clientttl(key);
      {
        fallback: () => {
          // Calculate T.T.L from fallback cache;
          const cached = thisfallback.Cacheget(key);
          if (cached && cachedttl) {
            const elapsed = (Date.now() - cachedcreated.At) / 1000;
            const remaining.Ttl = Math.max(0, cachedttl - elapsed);
            return Mathfloor(remaining.Ttl);
          return -2// Key does not exist}})}// Hash operations;
  async hget(key: string, field: string): Promise<string | null> {
    return circuit.Breakerredis.Operation(
      'hget';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected');

        const client = thisget.Read.Client();
        return await clienthget(key, field);
      {
        fallback: () => {
          const hash.Key = `hash:${key}:${field}`;
          const cached = thisfallback.Cacheget(hash.Key);
          if (cached && thisis.Entry.Valid(cached)) {
            return cachedvalue;
          return null}});

  async hset(key: string, field: string, value: string): Promise<number> {
    return circuit.Breakerredis.Operation(
      'hset';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected');

        const client = thisget.Client();
        const result = await clienthset(key, field, value)// Store in fallback cache;
        const hash.Key = `hash:${key}:${field}`;
        thisfallback.Cacheset(hash.Key, {
          value;
          created.At: Date.now()}),
        return result;
      {
        fallback: () => {
          const hash.Key = `hash:${key}:${field}`;
          thisfallback.Cacheset(hash.Key, {
            value;
            created.At: Date.now()}),
          return 1}})}// List operations;
  async lpush(key: string, .values: string[]): Promise<number> {
    return circuit.Breakerredis.Operation(
      'lpush';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected');

        const client = thisget.Client();
        return await clientlpush(key, .values);
      {
        fallback: () => {
          loggerwarn('⚠️ List operations not supported in fallback cache', LogContextCAC.H.E, {
            key});
          return 0}});

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return circuit.Breakerredis.Operation(
      'lrange';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected');

        const client = thisget.Read.Client();
        return await clientlrange(key, start, stop);
      {
        fallback: () => {
          loggerwarn('⚠️ List operations not supported in fallback cache', LogContextCAC.H.E, {
            key});
          return []}})}// Pub/Sub operations;
  async publish(channel: string, message: string): Promise<number> {
    return circuit.Breakerredis.Operation(
      'publish';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected');

        const client = thisget.Client();
        return await clientpublish(channel, message);
      {
        fallback: () => {
          loggerwarn('⚠️ Pub/Sub not available in fallback mode', LogContextCAC.H.E, { channel });
          return 0}})}// Helper method to check if cache entry is still valid;
  private is.Entry.Valid(entry: Cache.Entry): boolean {
    if (!entryttl) {
      return true, // No T.T.L means it never expires;

    const elapsed = (Date.now() - entrycreated.At) / 1000;
    return elapsed < entryttl}// Utility method to clear fallback cache;
  clear.Fallback.Cache(): void {
    thisfallback.Cacheclear();
    loggerinfo('🧹 Fallback cache cleared', LogContextCAC.H.E)}// Get fallback cache stats;
  getFallback.Cache.Stats(): {
    size: number,
    calculated.Size: number,
    item.Count: number} {
    return {
      size: thisfallback.Cachesize,
      calculated.Size: thisfallback.Cachecalculated.Size,
      item.Count: thisfallback.Cachesize,
    }}}// Lazy initialization function;
let _redis.Service: Redis.Service | null = null,
export function get.Redis.Service(): Redis.Service {
  if (!_redis.Service) {
    _redis.Service = Redis.Serviceget.Instance();
  return _redis.Service}// For backward compatibility and ease of use;
export const redis.Service = new Proxy({} as Redis.Service, {
  get(target, prop) {
    return get.Redis.Service()[prop as keyof Redis.Service]}});
export default Redis.Service;
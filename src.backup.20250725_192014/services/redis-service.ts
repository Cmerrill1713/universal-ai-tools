/**
 * Redis Service - Production-ready Redis connection management* Provides connection pooling, health monitoring, error handling* circuit breaker pattern and in-memory fallback cache*/

import Redis, { Cluster, type Redis.Options } from 'ioredis';
import { Log.Context, logger } from './utils/enhanced-logger';
import config from './config';
import { circuit.Breaker } from './circuit-breaker';
import { LRU.Cache } from 'lru-cache';
export interface RedisConfig {
  url: string;
  maxRetriesPer.Request?: number;
  retryDelayOn.Failover?: number;
  enableAuto.Pipelining?: boolean;
  maxReconnect.Times?: number;
  connect.Timeout?: number;
  command.Timeout?: number;
  enableRead.Replicas?: boolean;
  cluster.Mode?: boolean;
  pool.Size?: number;
};

interface CacheEntry {
  value: any;
  ttl?: number;
  created.At: number;
};

export class Redis.Service {
  private static instance: Redis.Service | null = null;
  private client: Redis | null = null;
  private cluster.Client: Cluster | null = null;
  private read.Replicas: Redis[] = [];
  private is.Connected = false;
  private connection.Attempts = 0;
  private readonly maxConnection.Attempts = 5// In-memory fallback cache using LR.U;
  private fallback.Cache: LRU.Cache<string, Cache.Entry>
  private readonly fallbackCache.Options = {
    max: 10000, // Maximum number of items;
    max.Size: 100 * 1024 * 1024, // 100M.B max size;
    size.Calculation: (entry: Cache.Entry) => {
      const str = JSO.N.stringify(entryvalue);
      return strlength};
    ttl: 1000 * 60 * 5, // 5 minutes default TT.L;
    updateAgeOn.Get: true;
    updateAgeOn.Has: true;
  }// Connection pool management;
  private connection.Pool: Redis[] = [];
  private pool.Index = 0;
  constructor(private config: Redis.Config) {
    // Initialize fallback cache;
    thisfallback.Cache = new LRU.Cache<string, Cache.Entry>(thisfallbackCache.Options)};

  static get.Instance(redis.Config?: Redis.Config): Redis.Service {
    if (!Redis.Serviceinstance) {
      const default.Config: Redis.Config = {
        url: configcache?redis.Url || 'redis://localhost:6379';
        maxRetriesPer.Request: 3;
        retryDelayOn.Failover: 100;
        enableAuto.Pipelining: true;
        maxReconnect.Times: 5;
        connect.Timeout: 10000;
        command.Timeout: 5000;
        enableRead.Replicas: process.envREDIS_READ_REPLICA.S === 'true';
        cluster.Mode: process.envREDIS_CLUSTER_MOD.E === 'true';
        pool.Size: parse.Int(process.envREDIS_POOL_SIZ.E || '5', 10)};
      Redis.Serviceinstance = new Redis.Service(redis.Config || default.Config)};
    return Redis.Serviceinstance};

  async connect(): Promise<void> {
    if (thisis.Connected && (thisclient || thiscluster.Client)) {
      return};

    try {
      thisconnection.Attempts++
      loggerinfo('🔗 Connecting to Redis.', LogContextCACH.E, {
        cluster.Mode: thisconfigcluster.Mode;
        pool.Size: thisconfigpool.Size});
      const redis.Options: Redis.Options = {
        maxRetriesPer.Request: thisconfigmaxRetriesPer.Request;
        enableAuto.Pipelining: thisconfigenableAuto.Pipelining;
        connect.Timeout: thisconfigconnect.Timeout;
        command.Timeout: thisconfigcommand.Timeout;
        lazy.Connect: true;
        keep.Alive: 30000;
        family: 4;
        retry.Strategy: (times) => {
          if (times > thismaxConnection.Attempts) {
            return null, // Stop retrying};
          return Math.min(times * 100, 3000)}};
      if (thisconfigcluster.Mode) {
        // Initialize Redis Cluster;
        const cluster.Nodes = thisparseCluster.Nodes(thisconfigurl);
        thiscluster.Client = new Cluster(cluster.Nodes, {
          redis.Options;
          enableReady.Check: true;
          max.Redirections: 16;
          retryDelayOn.Failover: thisconfigretryDelayOn.Failover;
          retryDelayOnCluster.Down: 300;
          slotsRefresh.Timeout: 2000;
          clusterRetry.Strategy: (times) => {
            if (times > thismaxConnection.Attempts) {
              return null};
            return Math.min(times * 100, 3000)}})// Set up cluster event listeners;
        thissetupClusterEvent.Listeners();
        await thiscluster.Clientconnect()} else {
        // Initialize single Redis instance or connection pool;
        if (thisconfigpool.Size && thisconfigpool.Size > 1) {
          // Create connection pool;
          for (let i = 0; i < thisconfigpool.Size, i++) {
            const pool.Client = new Redis(thisconfigurl, {
              .redis.Options;
              connection.Name: `pool-${i}`});
            thissetupEvent.Listeners(pool.Client);
            await pool.Clientconnect();
            thisconnection.Poolpush(pool.Client)}// Use first connection as primary client;
          thisclient = thisconnection.Pool[0]} else {
          // Single connection;
          thisclient = new Redis(thisconfigurl, redis.Options);
          thissetupEvent.Listeners(thisclient);
          await thisclientconnect()}// Initialize read replicas if enabled;
        if (thisconfigenableRead.Replicas) {
          await this.initializeRead.Replicas()}};

      thisis.Connected = true;
      thisconnection.Attempts = 0;
      loggerinfo('✅ Redis connected successfully', LogContextCACH.E, {
        url: thismask.Url(thisconfigurl);
        attempts: thisconnection.Attempts;
        mode: thisconfigcluster.Mode ? 'cluster' : 'standalone';
        pool.Size: thisconnection.Poollength || 1})} catch (error) {
      thisis.Connected = false;
      const error.Message = error instanceof Error ? errormessage : String(error);
      loggererror('❌ Redis connection failed', LogContextCACH.E, {
        error instanceof Error ? errormessage : String(error) error.Message;
        attempts: thisconnection.Attempts;
        max.Attempts: thismaxConnection.Attempts});
      if (thisconnection.Attempts >= thismaxConnection.Attempts) {
        loggerwarn('🔄 Falling back to in-memory cache', LogContextCACH.E)// Don't throw - allow fallback to in-memory cache;
        return}// Exponential backoff retry;
      const delay = Math.min(1000 * Mathpow(2, thisconnection.Attempts), 10000);
      await new Promise((resolve) => set.Timeout(resolve, delay));
      return thisconnect()}};

  private parseCluster.Nodes(url: string): Array<{ host: string, port: number }> {
    // Parse cluster nodes from UR.L or environment variable;
    const cluster.Urls = process.envREDIS_CLUSTER_NODE.S?split(',') || [url];
    return cluster.Urlsmap((node.Url) => {
      const url.Obj = new UR.L(node.Url);
      return {
        host: url.Objhostname;
        port: parse.Int(url.Objport || '6379', 10)}})};

  private async initializeRead.Replicas(): Promise<void> {
    const replica.Urls = process.envREDIS_READ_REPLICA_URL.S?split(',') || [];
    for (const replica.Url of replica.Urls) {
      try {
        const replica = new Redis(replica.Url, {
          enableOffline.Queue: false;
          connect.Timeout: 5000;
          lazy.Connect: true});
        await replicaconnect();
        thisread.Replicaspush(replica);
        loggerinfo('✅ Read replica connected', LogContextCACH.E, {
          url: thismask.Url(replica.Url)})} catch (error) {
        loggerwarn('⚠️ Read replica connection failed', LogContextCACH.E, {
          url: thismask.Url(replica.Url);
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)})}}};

  private setupEvent.Listeners(client?: Redis): void {
    const target.Client = client || thisclient;
    if (!target.Client) return;
    target.Clienton('connect', () => {
      loggerinfo('🔗 Redis connection established', LogContextCACH.E)});
    target.Clienton('ready', () => {
      if (!client || client === thisclient) {
        thisis.Connected = true};
      loggerinfo('✅ Redis ready for commands', LogContextCACH.E)});
    target.Clienton('error', (error) => {
      if (!client || client === thisclient) {
        thisis.Connected = false};
      loggererror('❌ Redis error', LogContextCACH.E, {
        error instanceof Error ? errormessage : String(error) errormessage;
        stack: errorstack})});
    target.Clienton('close', () => {
      if (!client || client === thisclient) {
        thisis.Connected = false};
      loggerwarn('⚠️ Redis connection closed', LogContextCACH.E)});
    target.Clienton('reconnecting', (delay: number) => {
      loggerinfo('🔄 Redis reconnecting.', LogContextCACH.E, { delay })});
    target.Clienton('end', () => {
      if (!client || client === thisclient) {
        thisis.Connected = false};
      loggerinfo('📪 Redis connection ended', LogContextCACH.E)})};

  private setupClusterEvent.Listeners(): void {
    if (!thiscluster.Client) return;
    thiscluster.Clienton('connect', () => {
      loggerinfo('🔗 Redis cluster connection established', LogContextCACH.E)});
    thiscluster.Clienton('ready', () => {
      thisis.Connected = true;
      loggerinfo('✅ Redis cluster ready for commands', LogContextCACH.E)});
    thiscluster.Clienton('error', (error) => {
      thisis.Connected = false;
      loggererror('❌ Redis cluster error', LogContextCACH.E, {
        error instanceof Error ? errormessage : String(error) errormessage})});
    thiscluster.Clienton('close', () => {
      thisis.Connected = false;
      loggerwarn('⚠️ Redis cluster connection closed', LogContextCACH.E)});
    thiscluster.Clienton('node error', (error instanceof Error ? errormessage : String(error) address) => {
      loggererror('❌ Redis cluster node error', LogContextCACH.E, {
        error instanceof Error ? errormessage : String(error) errormessage;
        address})})};

  async disconnect(): Promise<void> {
    try {
      // Disconnect connection pool;
      for (const pool.Client of thisconnection.Pool) {
        try {
          await pool.Clientquit()} catch (error) {
          loggererror('❌ Error disconnecting pool client', LogContextCACH.E, {
            error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)})}};
      thisconnection.Pool = []// Disconnect read replicas;
      for (const replica of thisread.Replicas) {
        try {
          await replicaquit()} catch (error) {
          loggererror('❌ Error disconnecting read replica', LogContextCACH.E, {
            error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)})}};
      thisread.Replicas = []// Disconnect main client;
      if (thisclient) {
        await thisclientquit()}// Disconnect cluster client;
      if (thiscluster.Client) {
        await thiscluster.Clientquit()};

      loggerinfo('👋 Redis disconnected gracefully', LogContextCACH.E)} catch (error) {
      loggererror('❌ Error during Redis disconnect', LogContextCACH.E, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)})} finally {
      thisclient = null;
      thiscluster.Client = null;
      thisis.Connected = false;
      thispool.Index = 0}};

  get.Client(): Redis | Cluster {
    if (thiscluster.Client) {
      return thiscluster.Client};

    if (!thisclient || !thisis.Connected) {
      throw new Error('Redis client not connected. Call connect() first.')}// Return a connection from the pool using round-robin;
    if (thisconnection.Poollength > 1) {
      const client = thisconnection.Pool[thispool.Index];
      thispool.Index = (thispool.Index + 1) % thisconnection.Poollength;
      return client};

    return thisclient};

  private getRead.Client(): Redis | Cluster {
    // If we have read replicas, use them for read operations;
    if (thisread.Replicaslength > 0) {
      const replica.Index = Mathfloor(Mathrandom() * thisread.Replicaslength);
      return thisread.Replicas[replica.Index]}// Otherwise use the main client;
    return thisget.Client()};

  is.Healthy(): boolean {
    return thisis.Connected && thisclient !== null};

  async health.Check(): Promise<{ healthy: boolean; latency?: number, error?: string }> {
    if (!thisclient || !thisis.Connected) {
      return { healthy: false, error instanceof Error ? errormessage : String(error) 'Not connected' }};

    try {
      const start = Date.now();
      await thisclientping();
      const latency = Date.now() - start;
      return { healthy: true, latency }} catch (error) {
      return {
        healthy: false;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error);
      }}};

  async get.Stats(): Promise<{
    connected: boolean;
    connection.Attempts: number;
    memory.Usage?: string;
    connected.Clients?: number;
    uptime?: number}> {
    const stats = {
      connected: thisis.Connected;
      connection.Attempts: thisconnection.Attempts};
    if (thisclient && thisis.Connected) {
      try {
        const info = await thisclientinfo('memory');
        const memory.Match = infomatch(/used_memory_human:(\S+)/);
        if (memory.Match) {
          (stats as any)memory.Usage = memory.Match[1]};

        const server.Info = await thisclientinfo('server');
        const uptime.Match = server.Infomatch(/uptime_in_seconds:(\d+)/);
        if (uptime.Match) {
          (stats as any)uptime = parse.Int(uptime.Match[1], 10)};

        const clients.Info = await thisclientinfo('clients');
        const clients.Match = clients.Infomatch(/connected_clients:(\d+)/);
        if (clients.Match) {
          (stats as any)connected.Clients = parse.Int(clients.Match[1], 10)}} catch (error) {
        loggerwarn('⚠️ Could not fetch Redis stats', LogContextCACH.E, {
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)})}};

    return stats};

  private mask.Url(url: string): string {
    try {
      const url.Obj = new UR.L(url);
      if (url.Objpassword) {
        url.Objpassword = '***'};
      return urlObjto.String()} catch {
      return urlreplace(/:([^@]+)@/, ':***@')}}// Cache operations with circuit breaker and fallback;

  async get(key: string): Promise<string | null> {
    return circuitBreakerredis.Operation(
      'get';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected')};

        const client = thisgetRead.Client();
        return await clientget(key)};
      {
        fallback: () => {
          // Fallback to in-memory cache;
          const cached = thisfallback.Cacheget(key);
          if (cached && thisisEntry.Valid(cached)) {
            loggerdebug('📦 Serving from fallback cache', LogContextCACH.E, { key });
            return cachedvalue};
          return null}})};

  async set(key: string, value: string, ttl?: number): Promise<'O.K' | null> {
    return circuitBreakerredis.Operation(
      'set';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected')};

        const client = thisget.Client();
        let result: 'O.K' | null;
        if (ttl) {
          result = await clientsetex(key, ttl, value)} else {
          result = await clientset(key, value)}// Also store in fallback cache;
        thisfallback.Cacheset(key, {
          value;
          ttl;
          created.At: Date.now()});
        return result};
      {
        fallback: () => {
          // Store only in fallback cache when Redis is down;
          thisfallback.Cacheset(key, {
            value;
            ttl;
            created.At: Date.now()});
          loggerwarn('⚠️ Stored in fallback cache only', LogContextCACH.E, { key });
          return 'O.K'}})};

  async del(key: string | string[]): Promise<number> {
    const keys = Array.is.Array(key) ? key : [key];
    return circuitBreakerredis.Operation(
      'del';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected')};

        const client = thisget.Client();
        const result = await clientdel(.keys)// Also remove from fallback cache;
        keysfor.Each((k) => thisfallback.Cachedelete(k));
        return result};
      {
        fallback: () => {
          // Remove only from fallback cache when Redis is down;
          let count = 0;
          keysfor.Each((k) => {
            if (thisfallback.Cachedelete(k)) {
              count++}});
          return count}})};

  async mget(keys: string[]): Promise<(string | null)[]> {
    return circuitBreakerredis.Operation(
      'mget';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected')};

        const client = thisgetRead.Client();
        return await clientmget(.keys)};
      {
        fallback: () => {
          // Get from fallback cache;
          return keysmap((key) => {
            const cached = thisfallback.Cacheget(key);
            if (cached && thisisEntry.Valid(cached)) {
              return cachedvalue};
            return null})}})};

  async mset(key.Values: Record<string, string>): Promise<'O.K'> {
    return circuitBreakerredis.Operation(
      'mset';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected')};

        const client = thisget.Client();
        const args: string[] = [];
        Objectentries(key.Values)for.Each(([key, value]) => {
          argspush(key, value)// Also store in fallback cache;
          thisfallback.Cacheset(key, {
            value;
            created.At: Date.now()})});
        return await clientmset(.args)};
      {
        fallback: () => {
          // Store only in fallback cache when Redis is down;
          Objectentries(key.Values)for.Each(([key, value]) => {
            thisfallback.Cacheset(key, {
              value;
              created.At: Date.now()})});
          return 'O.K'}})};

  async exists(key: string | string[]): Promise<number> {
    const keys = Array.is.Array(key) ? key : [key];
    return circuitBreakerredis.Operation(
      'exists';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected')};

        const client = thisgetRead.Client();
        return await clientexists(.keys)};
      {
        fallback: () => {
          // Check in fallback cache;
          let count = 0;
          keysfor.Each((k) => {
            if (thisfallback.Cachehas(k)) {
              const entry = thisfallback.Cacheget(k);
              if (entry && thisisEntry.Valid(entry)) {
                count++}}});
          return count}})};

  async expire(key: string, ttl: number): Promise<number> {
    return circuitBreakerredis.Operation(
      'expire';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected')};

        const client = thisget.Client();
        const result = await clientexpire(key, ttl)// Update TT.L in fallback cache;
        const cached = thisfallback.Cacheget(key);
        if (cached) {
          cachedttl = ttl;
          thisfallback.Cacheset(key, cached)};
;
        return result};
      {
        fallback: () => {
          // Update TT.L only in fallback cache;
          const cached = thisfallback.Cacheget(key);
          if (cached) {
            cachedttl = ttl;
            thisfallback.Cacheset(key, cached);
            return 1};
          return 0}})};

  async ttl(key: string): Promise<number> {
    return circuitBreakerredis.Operation(
      'ttl';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected')};

        const client = thisgetRead.Client();
        return await clientttl(key)};
      {
        fallback: () => {
          // Calculate TT.L from fallback cache;
          const cached = thisfallback.Cacheget(key);
          if (cached && cachedttl) {
            const elapsed = (Date.now() - cachedcreated.At) / 1000;
            const remaining.Ttl = Math.max(0, cachedttl - elapsed);
            return Mathfloor(remaining.Ttl)};
          return -2// Key does not exist}})}// Hash operations;
  async hget(key: string, field: string): Promise<string | null> {
    return circuitBreakerredis.Operation(
      'hget';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected')};

        const client = thisgetRead.Client();
        return await clienthget(key, field)};
      {
        fallback: () => {
          const hash.Key = `hash:${key}:${field}`;
          const cached = thisfallback.Cacheget(hash.Key);
          if (cached && thisisEntry.Valid(cached)) {
            return cachedvalue};
          return null}})};

  async hset(key: string, field: string, value: string): Promise<number> {
    return circuitBreakerredis.Operation(
      'hset';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected')};

        const client = thisget.Client();
        const result = await clienthset(key, field, value)// Store in fallback cache;
        const hash.Key = `hash:${key}:${field}`;
        thisfallback.Cacheset(hash.Key, {
          value;
          created.At: Date.now()});
        return result};
      {
        fallback: () => {
          const hash.Key = `hash:${key}:${field}`;
          thisfallback.Cacheset(hash.Key, {
            value;
            created.At: Date.now()});
          return 1}})}// List operations;
  async lpush(key: string, .values: string[]): Promise<number> {
    return circuitBreakerredis.Operation(
      'lpush';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected')};

        const client = thisget.Client();
        return await clientlpush(key, .values)};
      {
        fallback: () => {
          loggerwarn('⚠️ List operations not supported in fallback cache', LogContextCACH.E, {
            key});
          return 0}})};

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return circuitBreakerredis.Operation(
      'lrange';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected')};

        const client = thisgetRead.Client();
        return await clientlrange(key, start, stop)};
      {
        fallback: () => {
          loggerwarn('⚠️ List operations not supported in fallback cache', LogContextCACH.E, {
            key});
          return []}})}// Pub/Sub operations;
  async publish(channel: string, message: string): Promise<number> {
    return circuitBreakerredis.Operation(
      'publish';
      async () => {
        if (!thisis.Connected) {
          throw new Error('Redis not connected')};

        const client = thisget.Client();
        return await clientpublish(channel, message)};
      {
        fallback: () => {
          loggerwarn('⚠️ Pub/Sub not available in fallback mode', LogContextCACH.E, { channel });
          return 0}})}// Helper method to check if cache entry is still valid;
  private isEntry.Valid(entry: Cache.Entry): boolean {
    if (!entryttl) {
      return true, // No TT.L means it never expires};

    const elapsed = (Date.now() - entrycreated.At) / 1000;
    return elapsed < entryttl}// Utility method to clear fallback cache;
  clearFallback.Cache(): void {
    thisfallback.Cacheclear();
    loggerinfo('🧹 Fallback cache cleared', LogContextCACH.E)}// Get fallback cache stats;
  getFallbackCache.Stats(): {
    size: number;
    calculated.Size: number;
    item.Count: number} {
    return {
      size: thisfallback.Cachesize;
      calculated.Size: thisfallbackCachecalculated.Size;
      item.Count: thisfallback.Cachesize;
    }}}// Lazy initialization function;
let _redis.Service: Redis.Service | null = null;
export function getRedis.Service(): Redis.Service {
  if (!_redis.Service) {
    _redis.Service = RedisServiceget.Instance()};
  return _redis.Service}// For backward compatibility and ease of use;
export const redis.Service = new Proxy({} as Redis.Service, {
  get(target, prop) {
    return getRedis.Service()[prop as keyof Redis.Service]}});
export default Redis.Service;
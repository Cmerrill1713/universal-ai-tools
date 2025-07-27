import { Redis } from 'ioredis';
import { Log.Context, logger } from './enhanced-logger';
import { performance.Monitor } from './performance-monitor';
export interface Cache.Options {
  ttl?: number;
  compress?: boolean;
  namespace?: string;
  tags?: string[];
  retry?: number;
  fallback?: boolean;
}
export interface Cache.Stats {
  hits: number,
  misses: number,
  sets: number,
  deletes: number,
  hit.Rate: number,
  total.Requests: number,
  avg.Response.Time: number,
  memory.Usage: number,
  key.Count: number,
}
interface Circuit.Breaker.State {
  failures: number,
  last.Failure.Time: number,
  state: 'CLOS.E.D' | 'OP.E.N' | 'HALF_OP.E.N',
  success.Count: number,
}
export class Improved.Cache.Manager {
  private redis: Redis,
  private fallback.Cache: Map<string, { value: any; expires: number; tags: string[] }>
  private stats: Cache.Stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hit.Rate: 0,
    total.Requests: 0,
    avg.Response.Time: 0,
    memory.Usage: 0,
    key.Count: 0,
}  private default.Ttl = 3600// 1 hour;
  private max.Fallback.Size = 1000;
  private circuit.Breaker: Circuit.Breaker.State = {
    failures: 0,
    last.Failure.Time: 0,
    state: 'CLOS.E.D',
    success.Count: 0,
}  private readonly circuit.Breaker.Threshold = 5;
  private readonly circuit.Breaker.Timeout = 60000// 1 minute;
  private readonly half.Open.Requests = 3;
  private connection.Retry.Count = 0;
  private max.Connection.Retries = 5;
  private is.Connected = false;
  constructor(redis.Url: string) {
    thisfallback.Cache = new Map()// Create Redis instance with improved configuration;
    thisredis = new Redis(redis.Url, {
      // Connection pool settings;
      maxRetries.Per.Request: 3,
      enable.Ready.Check: true,
      lazy.Connect: false, // Connect immediately// Timeouts;
      connect.Timeout: 5000, // 5 seconds;
      command.Timeout: 3000, // 3 seconds// Reconnection strategy with exponential backoff;
      retry.Strategy: (times: number) => {
        const max.Delay = 30000// 30 seconds;
        const base.Delay = 100;
        const delay = Math.min(base.Delay * Mathpow(2, times), max.Delay);
        if (times > thismax.Connection.Retries) {
          loggererror(`Redis connection failed after ${times} attempts`, LogContextCAC.H.E)// Don't stop retrying, but log the issue;

        loggerwarn(`Redis reconnection attempt ${times}, waiting ${delay}ms`, LogContextCAC.H.E);
        return delay}// Connection keep-alive;
      keep.Alive: 10000// Enable offline queue,
      enable.Offline.Queue: true// Connection pool size,
      connection.Name: 'universal-ai-cache'}),
    thissetup.Event.Listeners();
    thissetup.Health.Check();

  private setup.Event.Listeners(): void {
    thisredison('connect', () => {
      loggerinfo('Redis connecting.');
      thisconnection.Retry.Count = 0});
    thisredison('ready', () => {
      loggerinfo('Redis connection ready');
      thisis.Connected = true;
      thisreset.Circuit.Breaker()});
    thisredison('error', (error) => {
      loggererror('Redis error', LogContextCAC.H.E, { error });
      thishandle.Connection.Error()});
    thisredison('close', () => {
      loggerwarn('Redis connection closed');
      thisis.Connected = false});
    thisredison('reconnecting', (delay: number) => {
      loggerinfo(`Redis reconnecting in ${delay}ms`);
      thisconnection.Retry.Count++});
    thisredison('end', () => {
      loggererror('Redis connection ended');
      thisis.Connected = false});

  private setup.Health.Check(): void {
    // Periodic health check every 30 seconds;
    set.Interval(async () => {
      if (thisis.Connected) {
        try {
          await thisredisping()} catch (error) {
          loggererror('Redis health check failed:', LogContextCAC.H.E, { error });
          thishandle.Connection.Error()}}}, 30000);

  private handle.Connection.Error(): void {
    thiscircuit.Breakerfailures++
    thiscircuitBreakerlast.Failure.Time = Date.now();
    if (thiscircuit.Breakerfailures >= thiscircuit.Breaker.Threshold) {
      thisopen.Circuit.Breaker();
    };

  private handle.Error(error instanceof Error ? error.message : String(error) any): void {
    thishandle.Connection.Error();
}
  private open.Circuit.Breaker(): void {
    thiscircuit.Breakerstate = 'OP.E.N';
    loggerwarn('Redis circuit breaker opened due to repeated failures')// Schedule circuit breaker half-open after timeout;
    set.Timeout(() => {
      thiscircuit.Breakerstate = 'HALF_OP.E.N';
      thiscircuit.Breakersuccess.Count = 0;
      loggerinfo('Redis circuit breaker moved to half-open state')}, thiscircuit.Breaker.Timeout);

  private reset.Circuit.Breaker(): void {
    thiscircuit.Breaker = {
      failures: 0,
      last.Failure.Time: 0,
      state: 'CLOS.E.D',
      success.Count: 0,
    };

  private async check.Circuit.Breaker(): Promise<boolean> {
    if (thiscircuit.Breakerstate === 'OP.E.N') {
      const time.Elapsed = Date.now() - thiscircuitBreakerlast.Failure.Time;
      if (time.Elapsed < thiscircuit.Breaker.Timeout) {
        return false};

    if (thiscircuit.Breakerstate === 'HALF_OP.E.N') {
      // Allow limited requests in half-open state;
      return thiscircuit.Breakersuccess.Count < thishalf.Open.Requests;

    return true;

  private handleCircuit.Breaker.Success(): void {
    if (thiscircuit.Breakerstate === 'HALF_OP.E.N') {
      thiscircuit.Breakersuccess.Count++
      if (thiscircuit.Breakersuccess.Count >= thishalf.Open.Requests) {
        thisreset.Circuit.Breaker();
        loggerinfo('Redis circuit breaker closed - connection restored');
      }};

  private build.Key(key: string, namespace?: string): string {
    const prefix = namespace || 'universal-ai';
    return `${prefix}:${key}`;

  private with.Namespace(key: string, namespace?: string): string {
    return thisbuild.Key(key, namespace);

  private async compress(value: any): Promise<string> {
    try {
      const zlib = require('zlib');
      const json = JS.O.N.stringify(value);
      const compressed = zlibgzip.Sync(json);
      return compressedto.String('base64')} catch (error) {
      loggererror('Compression error', LogContextCAC.H.E, { error });
      return JS.O.N.stringify(value)};

  private async decompress(value: string): Promise<unknown> {
    try {
      const zlib = require('zlib');
      const compressed = Bufferfrom(value, 'base64');
      const decompressed = zlibgunzip.Sync(compressed);
      return JS.O.N.parse(decompressedto.String())} catch (error) {
      // Try parsing as regular JS.O.N.if decompression fails;
      try {
        return JS.O.N.parse(value)} catch {
        loggererror('Decompression error', LogContextCAC.H.E, { error });
        throw error}};

  private update.Stats(operation: 'hit' | 'miss' | 'set' | 'delete', response.Time: number): void {
    thisstats[
      operation === 'hit'? 'hits': operation === 'miss'? 'misses': operation === 'set'? 'sets': 'deletes']++
    thisstatstotal.Requests++
    thisstatsavg.Response.Time =
      (thisstatsavg.Response.Time * (thisstatstotal.Requests - 1) + response.Time) /
      thisstatstotal.Requests;
    thisstatshit.Rate =
      thisstatstotal.Requests > 0 ? (thisstatshits / thisstatstotal.Requests) * 100 : 0;
    performanceMonitorrecord.Cache.Access(operation === 'hit');
}
  private async use.Fallback(key: string, value?: any, ttl?: number): Promise<unknown> {
    const full.Key = thisbuild.Key(key);
    if (value !== undefined) {
      // Set operation;
      if (thisfallback.Cachesize >= thismax.Fallback.Size) {
        // Remove oldest entries;
        const entries.To.Remove = Mathfloor(thismax.Fallback.Size * 0.1)// Remove 10%;
        const keys = Arrayfrom(thisfallback.Cachekeys())slice(0, entries.To.Remove);
        keysfor.Each((k) => thisfallback.Cachedelete(k));

      thisfallback.Cacheset(full.Key, {
        value;
        expires: Date.now() + (ttl || thisdefault.Ttl) * 1000,
        tags: []}),
      return value} else {
      // Get operation;
      const cached = thisfallback.Cacheget(full.Key);
      if (cached && cachedexpires > Date.now()) {
        return cachedvalue;

      if (cached) {
        thisfallback.Cachedelete(full.Key);

      return null};

  public async get<T = any>(key: string, options: Cache.Options = {}): Promise<T | null> {
    const start.Time = processhrtime();
    try {
      // Check circuit breaker;
      if (!(await thischeck.Circuit.Breaker())) {
        loggerdebug('Redis circuit breaker is open, using fallback cache');
        const fallback.Value = await thisuse.Fallback(key);
        const [seconds, nanoseconds] = processhrtime(start.Time);
        const response.Time = seconds * 1000 + nanoseconds / 1000000;
        thisupdate.Stats(fallback.Value !== null ? 'hit' : 'miss', response.Time);
        return fallback.Value;

      const full.Key = thisbuild.Key(key, optionsnamespace);
      const value = await thisredisget(full.Key);
      thishandleCircuit.Breaker.Success();
      const [seconds, nanoseconds] = processhrtime(start.Time);
      const response.Time = seconds * 1000 + nanoseconds / 1000000;
      if (value !== null) {
        thisupdate.Stats('hit', response.Time);
        return optionscompress ? await thisdecompress(value) : JS.O.N.parse(value)} else {
        thisupdate.Stats('miss', response.Time);
        return null}} catch (error) {
      loggererror('Cache get error', LogContextCAC.H.E, { error });
      thishandle.Connection.Error()// Always try fallback on error;
      const fallback.Value = await thisuse.Fallback(key);
      const [seconds, nanoseconds] = processhrtime(start.Time);
      const response.Time = seconds * 1000 + nanoseconds / 1000000;
      thisupdate.Stats(fallback.Value !== null ? 'hit' : 'miss', response.Time);
      return fallback.Value};

  public async set(key: string, value: any, options: Cache.Options = {}): Promise<boolean> {
    const start.Time = processhrtime()// Always update fallback cache;
    await thisuse.Fallback(key, value, optionsttl);
    try {
      // Check circuit breaker;
      if (!(await thischeck.Circuit.Breaker())) {
        loggerdebug('Redis circuit breaker is open, only using fallback cache');
        const [seconds, nanoseconds] = processhrtime(start.Time);
        const response.Time = seconds * 1000 + nanoseconds / 1000000;
        thisupdate.Stats('set', response.Time);
        return true// Return true since fallback succeeded;

      const full.Key = thisbuild.Key(key, optionsnamespace);
      const ttl = optionsttl || thisdefault.Ttl;
      const serialized = optionscompress ? await thiscompress(value) : JS.O.N.stringify(value);
      const multi = thisredismulti();
      multisetex(full.Key, ttl, serialized)// Add tags for bulk invalidation;
      if (optionstags && optionstagslength > 0) {
        const tag.Keys = optionstagsmap((tag) => thisbuild.Key(`tag:${tag}`, optionsnamespace));
        tag.Keysfor.Each((tag.Key) => {
          multisadd(tag.Key, full.Key);
          multiexpire(tag.Key, ttl)});

      await multiexec();
      thishandleCircuit.Breaker.Success();
      const [seconds, nanoseconds] = processhrtime(start.Time);
      const response.Time = seconds * 1000 + nanoseconds / 1000000;
      thisupdate.Stats('set', response.Time);
      return true} catch (error) {
      loggererror('Cache set error', LogContextCAC.H.E, { error });
      thishandle.Connection.Error();
      const [seconds, nanoseconds] = processhrtime(start.Time);
      const response.Time = seconds * 1000 + nanoseconds / 1000000;
      thisupdate.Stats('set', response.Time)// Return true since fallback succeeded;
      return true};

  public async del(key: string, options: Cache.Options = {}): Promise<boolean> {
    const start.Time = processhrtime()// Always remove from fallback cache;
    const full.Key = thisbuild.Key(key, optionsnamespace);
    thisfallback.Cachedelete(full.Key);
    try {
      // Check circuit breaker;
      if (!(await thischeck.Circuit.Breaker())) {
        const [seconds, nanoseconds] = processhrtime(start.Time);
        const response.Time = seconds * 1000 + nanoseconds / 1000000;
        thisupdate.Stats('delete', response.Time);
        return true;

      const result = await thisredisdel(full.Key);
      thishandleCircuit.Breaker.Success();
      const [seconds, nanoseconds] = processhrtime(start.Time);
      const response.Time = seconds * 1000 + nanoseconds / 1000000;
      thisupdate.Stats('delete', response.Time);
      return result > 0} catch (error) {
      loggererror('Cache delete error', LogContextCAC.H.E, { error });
      thishandle.Connection.Error();
      const [seconds, nanoseconds] = processhrtime(start.Time);
      const response.Time = seconds * 1000 + nanoseconds / 1000000;
      thisupdate.Stats('delete', response.Time);
      return true// Return true since fallback succeeded};

  public async invalidate.By.Tags(tags: string[], options: Cache.Options = {}): Promise<number> {
    try {
      if (!(await thischeck.Circuit.Breaker())) {
        return 0;

      let total.Invalidated = 0;
      for (const tag of tags) {
        const tag.Key = thisbuild.Key(`tag:${tag}`, optionsnamespace);
        const keys = await thisredissmembers(tag.Key);
        if (keyslength > 0) {
          const deleted = await thisredisdel(.keys);
          total.Invalidated += deleted;

        await thisredisdel(tag.Key);

      thishandleCircuit.Breaker.Success();
      return total.Invalidated} catch (error) {
      loggererror('Cache invalidation error', LogContextCAC.H.E, { error });
      thishandle.Connection.Error();
      return 0};

  public async exists(key: string, options: Cache.Options = {}): Promise<boolean> {
    try {
      if (!(await thischeck.Circuit.Breaker())) {
        const full.Key = thisbuild.Key(key, optionsnamespace);
        const cached = thisfallback.Cacheget(full.Key);
        return cached !== undefined && cachedexpires > Date.now();

      const full.Key = thisbuild.Key(key, optionsnamespace);
      const result = await thisredisexists(full.Key);
      thishandleCircuit.Breaker.Success();
      return result > 0} catch (error) {
      loggererror('Cache exists error', LogContextCAC.H.E, { error });
      thishandle.Connection.Error()// Check fallback;
      const full.Key = thisbuild.Key(key, optionsnamespace);
      const cached = thisfallback.Cacheget(full.Key);
      return cached !== undefined && cachedexpires > Date.now()};

  public async ttl(key: string, options: Cache.Options = {}): Promise<number> {
    try {
      if (!(await thischeck.Circuit.Breaker())) {
        return -1;

      const full.Key = thisbuild.Key(key, optionsnamespace);
      const ttl = await thisredisttl(full.Key);
      thishandleCircuit.Breaker.Success();
      return ttl} catch (error) {
      loggererror('Cache T.T.L.error', LogContextCAC.H.E, { error });
      thishandle.Connection.Error();
      return -1};

  public async get.Stats(): Promise<Cache.Stats> {
    try {
      if (!(await thischeck.Circuit.Breaker()) || !thisis.Connected) {
        // Return cached stats when Redis is unavailable;
        thisstatskey.Count = thisfallback.Cachesize;
        return { .thisstats };

      const info = await thisredisinfo('memory');
      const memory.Match = infomatch(/used_memory:(\d+)/);
      thisstatsmemory.Usage = memory.Match ? parse.Int(memory.Match[1], 10) : 0;
      const key.Count = await thisredisdbsize();
      thisstatskey.Count = key.Count;
      thishandleCircuit.Breaker.Success();
      return { .thisstats }} catch (error) {
      loggererror('Cache stats error', LogContextCAC.H.E, { error });
      thishandle.Connection.Error()// Return fallback stats;
      thisstatskey.Count = thisfallback.Cachesize;
      return { .thisstats }};

  public async health.Check(): Promise<{ healthy: boolean; latency: number; error instanceof Error ? error.message : String(error) string }> {
    const start.Time = processhrtime();
    try {
      if (thiscircuit.Breakerstate === 'OP.E.N') {
        return {
          healthy: false,
          latency: 0,
          error instanceof Error ? error.message : String(error) 'Circuit breaker is open';
        };

      await thisredisping();
      const [seconds, nanoseconds] = processhrtime(start.Time);
      const latency = seconds * 1000 + nanoseconds / 1000000;
      thishandleCircuit.Breaker.Success();
      return { healthy: true, latency }} catch (error) {
      const [seconds, nanoseconds] = processhrtime(start.Time);
      const latency = seconds * 1000 + nanoseconds / 1000000;
      thishandle.Connection.Error();
      return {
        healthy: false,
        latency;
        error instanceof Error ? error.message : String(error) error instanceof Error ? error.message : 'Unknown error';
      }};

  public async close(): Promise<void> {
    try {
      await thisredisquit()} catch (error) {
      loggererror('Error closing Redis connection:', LogContextCAC.H.E, { error });
    thisfallback.Cacheclear()}// Utility methods for common caching patterns;
  public async remember<T>(
    key: string,
    factory: () => Promise<T>
    options: Cache.Options = {
}): Promise<T> {
    const cached = await thisget<T>(key, options);
    if (cached !== null) {
      return cached;

    const value = await factory();
    await thisset(key, value, options);
    return value;

  public async remember.Forever<T>(
    key: string,
    factory: () => Promise<T>
    options: Cache.Options = {
}): Promise<T> {
    return thisremember(key, factory, { .options, ttl: 0 }),

  public create.Cache.Key(.parts: (string | number)[]): string {
    return partsjoin(':');

  public getCircuit.Breaker.Status(): Circuit.Breaker.State {
    return { .thiscircuit.Breaker };

  public is.Redis.Connected(): boolean {
    return thisis.Connected && thiscircuit.Breakerstate === 'CLOS.E.D'}/**
   * Flush all cache keys*/
  public async flush(): Promise<void> {
    try {
      if (!(await thischeck.Circuit.Breaker())) {
        loggerwarn('Circuit breaker open, clearing fallback cache only');
        thisfallback.Cacheclear();
        return;

      await thisredisflushdb();
      thisfallback.Cacheclear();
      thisstatsdeletes++
      loggerinfo('Cache flushed successfully')} catch (error) {
      loggererror('Error flushing cache:', LogContextCAC.H.E, { error });
      thishandle.Error(error);
      thisfallback.Cacheclear()}}/**
   * Get multiple values at once*/
  public async get.Multiple<T = any>(
    keys: string[],
    options: Cache.Options = {
}): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    try {
      if (!(await thischeck.Circuit.Breaker())) {
        // Fallback to individual gets from fallback cache;
        for (const key of keys) {
          const cached = thisfallback.Cacheget(thiswith.Namespace(key, optionsnamespace));
          if (cached && cachedexpires > Date.now()) {
            resultsset(key, cachedvalue)} else {
            resultsset(key, null)};
        return results;

      const namespaced.Keys = keysmap((key) => thiswith.Namespace(key, optionsnamespace));
      const values = await thisredismget(namespaced.Keys);
      keysfor.Each((key, index) => {
        const value = values[index];
        if (value) {
          try {
            resultsset(key, JS.O.N.parse(value));
            thisstatshits++} catch {
            resultsset(key, null);
            thisstatsmisses++}} else {
          resultsset(key, null);
          thisstatsmisses++}});
      return results} catch (error) {
      loggererror('Error getting multiple values:', LogContextCAC.H.E, { error });
      thishandle.Error(error)// Return empty results on error;
      keysfor.Each((key) => resultsset(key, null));
      return results}}/**
   * Set multiple values at once*/
  public async set.Multiple(entries: Array<[string, any, Cache.Options?]>): Promise<void> {
    try {
      if (!(await thischeck.Circuit.Breaker())) {
        // Fallback to individual sets in fallback cache;
        for (const [key, value, options = {}] of entries) {
          const ttl = optionsttl || thisdefault.Ttl;
          const expires = ttl > 0 ? Date.now() + ttl * 1000 : NumberMAX_SAFE_INTEG.E.R;
          thisfallback.Cacheset(thiswith.Namespace(key, optionsnamespace), {
            value;
            expires;
            tags: optionstags || []}),
        return;

      const pipeline = thisredispipeline();
      for (const [key, value, options = {}] of entries) {
        const namespaced.Key = thiswith.Namespace(key, optionsnamespace);
        const ttl = optionsttl || thisdefault.Ttl;
        const serialized = JS.O.N.stringify(value);
        if (ttl > 0) {
          pipelinesetex(namespaced.Key, ttl, serialized)} else {
          pipelineset(namespaced.Key, serialized)}// Handle tags;
        if (optionstags && optionstagslength > 0) {
          for (const tag of optionstags) {
            pipelinesadd(`tag:${tag}`, namespaced.Key)}};

      await pipelineexec();
      thisstatssets += entrieslength} catch (error) {
      loggererror('Error setting multiple values:', LogContextCAC.H.E, { error });
      thishandle.Error(error)}}/**
   * Extend the T.T.L.of a cached value*/
  public async extend(key: string, ttl: number, options: Cache.Options = {}): Promise<boolean> {
    try {
      if (!(await thischeck.Circuit.Breaker())) {
        // Try to extend in fallback cache;
        const namespaced.Key = thiswith.Namespace(key, optionsnamespace);
        const cached = thisfallback.Cacheget(namespaced.Key);
        if (cached) {
          cachedexpires = Date.now() + ttl * 1000;
          return true;
        return false;

      const namespaced.Key = thiswith.Namespace(key, optionsnamespace);
      const result = await thisredisexpire(namespaced.Key, ttl);
      return result === 1} catch (error) {
      loggererror('Error extending cache T.T.L:', LogContextCAC.H.E, { error });
      thishandle.Error(error);
      return false}};

export default Improved.Cache.Manager;
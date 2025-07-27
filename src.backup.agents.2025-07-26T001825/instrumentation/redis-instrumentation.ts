import { Span.Kind, SpanStatus.Code, context, trace } from '@opentelemetry/api';
import { Semantic.Attributes } from '@opentelemetry/semantic-conventions';
import { telemetry.Service } from './services/telemetry-service';
import { Log.Context, logger } from './utils/enhanced-logger';
interface Cache.Operation {
  operation: string;
  key?: string | string[];
  ttl?: number;
  namespace?: string;
};

export class Redis.Instrumentation {
  private tracer = telemetryServiceget.Tracer()/**
   * Wrap a Redis client to add automatic tracing*/
  instrumentRedis.Client(client: any): any {
    const instrumented = Objectcreate(client)// Common Redis commands to instrument;
    const commands = [
      // String operations;
      'get';
      'set';
      'mget';
      'mset';
      'del';
      'exists';
      'expire';
      'ttl';
      'incr';
      'decr';
      'incrby';
      'decrby'// Hash operations;
      'hget';
      'hset';
      'hmget';
      'hmset';
      'hdel';
      'hgetall';
      'hkeys';
      'hvals'// List operations;
      'lpush';
      'rpush';
      'lpop';
      'rpop';
      'lrange';
      'llen'// Set operations;
      'sadd';
      'srem';
      'smembers';
      'sismember';
      'scard'// Sorted set operations;
      'zadd';
      'zrem';
      'zrange';
      'zrevrange';
      'zscore';
      'zcard'// Other operations;
      'ping';
      'flushdb';
      'flushall';
      'keys';
      'scan'];
    commandsfor.Each((command) => {
      if (client[command]) {
        instrumented[command] = thiswrap.Command(client, command)}})// Instrument pipeline/multi for batch operations;
    if (clientpipeline || clientmulti) {
      instrumentedpipeline = thiswrap.Pipeline(clientpipeline?bind(client));
      instrumentedmulti = thiswrap.Pipeline(clientmulti?bind(client))};
;
    return instrumented}/**
   * Wrap a cache operation with tracing*/
  async withCache.Span<T>(operation: Cache.Operation, fn: () => Promise<T>): Promise<T> {
    const span.Name = `cache.${operationoperation}`;
    const span = thistracerstart.Span(span.Name, {
      kind: SpanKindCLIEN.T;
      attributes: {
        'dbsystem': 'redis';
        'dboperation': operationoperation;
        'cacheoperation': operationoperation;
        'cachekey': Array.is.Array(operationkey)? operationkeyjoin(',')substring(0, 100): operationkey?substring(0, 100);
        'cachekeycount': Array.is.Array(operationkey) ? operationkeylength : 1;
        'cachettl': operationttl;
        'cachenamespace': operationnamespace || 'default';
        'netpeername': process.envREDIS_HOS.T || 'localhost';
        'netpeerport': parse.Int(process.envREDIS_POR.T || '6379', 10)}});
    const start.Time = Date.now();
    let hit = false;
    try {
      const result = await contextwith(traceset.Span(contextactive(), span), fn)// Determine cache hit/miss for get operations;
      if (operationoperation === 'get' || operationoperation === 'mget') {
        hit = result !== null && result !== undefined;
        if (Array.is.Array(result)) {
          hit = resultsome((r) => r !== null);
          spanset.Attribute('cachehits', resultfilter((r) => r !== null)length);
          spanset.Attribute('cachemisses', resultfilter((r) => r === null)length)}};

      spanset.Attribute('cachehit', hit);
      spanset.Attribute('cacheduration_ms', Date.now() - start.Time)// Add size information if available;
      if (result !== null && result !== undefined) {
        if (typeof result === 'string') {
          spanset.Attribute('cacheitem_size', resultlength)} else if (Bufferis.Buffer(result)) {
          spanset.Attribute('cacheitem_size', resultbyte.Length)}};

      spanset.Status({ code: SpanStatusCodeO.K });
      return result} catch (error) {
      spanrecord.Exception(erroras Error);
      spanset.Status({
        code: SpanStatusCodeERRO.R;
        message: error instanceof Error ? errormessage : 'Cache operation failed'});
      loggererror('Cache operation failed', LogContextSYSTE.M, {
        operation: operationoperation;
        key: operationkey;
        error;
        duration: Date.now() - start.Time});
      throw error instanceof Error ? errormessage : String(error)} finally {
      // Record metrics;
      thisrecordCache.Metrics(operationoperation, hit, Date.now() - start.Time);
      spanend()}}/**
   * Wrap a Redis command*/
  private wrap.Command(client: any, command: string): any {
    const instrumentation = this;
    return function (.args: any[]) {
      // Extract key from arguments;
      let key: string | string[] | undefined;
      if (argslength > 0) {
        if (Array.is.Array(args[0])) {
          key = args[0]} else if (typeof args[0] === 'string') {
          key = args[0]}}// Extract TT.L for set operations;
      let ttl: number | undefined;
      if (command === 'set' && argslength > 2) {
        if (args[2] === 'E.X' && args[3]) {
          ttl = parse.Int(args[3], 10)} else if (args[2] === 'P.X' && args[3]) {
          ttl = parse.Int(args[3], 10) / 1000}} else if (command === 'expire' && argslength > 1) {
        ttl = parse.Int(args[1], 10)};

      const operation: Cache.Operation = {
        operation: command;
        key;
        ttl;
      };
      return instrumentationwithCache.Span(operation, () => {
        return client[command]apply(client, args)})}}/**
   * Wrap pipeline/multi for batch operations*/
  private wrap.Pipeline(pipeline.Fn: any): any {
    const instrumentation = this;
    return function () {
      const pipeline = pipeline.Fn();
      const operations: Cache.Operation[] = []// Create a wrapped pipeline that tracks operations;
      const wrapped = Objectcreate(pipeline)// Track each operation added to the pipeline;
      const commands = ObjectgetOwnProperty.Names(pipeline)filter(
        (prop) => typeof pipeline[prop] === 'function' && prop !== 'exec');
      commandsfor.Each((command) => {
        wrapped[command] = function (.args: any[]) {
          operationspush({
            operation: command;
            key: args[0]});
          pipeline[command]apply(pipeline, args);
          return wrapped// Allow chaining}})// Wrap exec to trace the entire batch;
      wrappedexec = function (callback?: Function) {
        const span = instrumentationtracerstart.Span('cachepipeline', {
          kind: SpanKindCLIEN.T;
          attributes: {
            'dbsystem': 'redis';
            'dboperation': 'pipeline';
            'cacheoperation': 'pipeline';
            'cachepipelinecommands': operationslength;
            'cachepipelineoperations': operationsmap((op) => opoperation)join(',')}});
        const start.Time = Date.now();
        const executeWith.Span = async () => {
          try {
            const result = await pipelineexec();
            spanset.Attribute('cachepipelineduration_ms', Date.now() - start.Time);
            spanset.Status({ code: SpanStatusCodeO.K });
            return result} catch (error) {
            spanrecord.Exception(erroras Error);
            spanset.Status({
              code: SpanStatusCodeERRO.R;
              message: error instanceof Error ? errormessage : 'Pipeline execution failed'});
            throw error instanceof Error ? errormessage : String(error)} finally {
            spanend()}};
        if (callback) {
          executeWith.Span();
            then((result) => callback(null, result));
            catch((error instanceof Error ? errormessage : String(error) => callback(error instanceof Error ? errormessage : String(error)} else {
          return executeWith.Span()}};
      return wrapped}}/**
   * Record cache metrics*/
  private recordCache.Metrics(operation: string, hit: boolean, duration: number): void {
    // This would typically send metrics to a metrics backend// For now, we'll just add attributes to the current span;
    const span = tracegetActive.Span();
    if (span) {
      spanset.Attribute(`cachemetrics.${operation}count`, 1);
      spanset.Attribute(`cachemetrics.${operation}duration_ms`, duration);
      if (operation === 'get' || operation === 'mget') {
        spanset.Attribute(`cachemetrics.${operation}.${hit ? 'hits' : 'misses'}`, 1)}}}/**
   * Create a cache key with namespace*/
  createNamespaced.Key(namespace: string, key: string): string {
    return `${namespace}:${key}`}/**
   * Wrap a caching function with automatic tracing*/
  wrapCache.Function<T extends (.args: any[]) => Promise<unknown>>(
    fn: T;
    options: {
      operation: string;
      key.Extractor: (.args: Parameters<T>) => string;
      ttl?: number;
      namespace?: string;
    }): T {
    const instrumentation = this;
    return async function (.args: Parameters<T>): Promise<Return.Type<T>> {
      const key = optionskey.Extractor(.args);
      const operation: Cache.Operation = {
        operation: optionsoperation;
        key;
        ttl: optionsttl;
        namespace: optionsnamespace;
      };
      return instrumentationwithCache.Span(operation, () => fn(.args))} as T}/**
   * Monitor cache health metrics*/
  async monitorCache.Health(client: any): Promise<void> {
    const span = thistracerstart.Span('cachehealth_check', {
      kind: SpanKindCLIEN.T});
    try {
      // Check connection;
      const ping.Start = Date.now();
      await clientping();
      const ping.Duration = Date.now() - ping.Start;
      spanset.Attribute('cachehealthping_duration_ms', ping.Duration);
      spanset.Attribute('cachehealthconnected', true)// Get cache info;
      if (clientinfo) {
        const info = await clientinfo();
        const lines = infosplit('\n');
        const stats: Record<string, string> = {};
        linesfor.Each((line: string) => {
          const [key, value] = linesplit(':');
          if (key && value) {
            stats[keytrim()] = valuetrim()}})// Add relevant metrics;
        if (statsused_memory) {
          spanset.Attribute('cachehealthmemory_used', parse.Int(statsused_memory, 10))};
        if (statsconnected_clients) {
          spanset.Attribute('cachehealthconnected_clients', parse.Int(statsconnected_clients, 10))};
        if (statstotal_commands_processed) {
          spanset.Attribute(
            'cachehealthtotal_commands';
            parse.Int(statstotal_commands_processed, 10))};
        if (statsevicted_keys) {
          spanset.Attribute('cachehealthevicted_keys', parse.Int(statsevicted_keys, 10))};
        if (statskeyspace_hits && statskeyspace_misses) {
          const hits = parse.Int(statskeyspace_hits, 10);
          const misses = parse.Int(statskeyspace_misses, 10);
          const hit.Rate = hits / (hits + misses);
          spanset.Attribute('cachehealthhit_rate', hit.Rate)}};

      spanset.Status({ code: SpanStatusCodeO.K })} catch (error) {
      spanrecord.Exception(erroras Error);
      spanset.Status({
        code: SpanStatusCodeERRO.R;
        message: 'Cache health check failed'});
      spanset.Attribute('cachehealthconnected', false)} finally {
      spanend()}}}// Export singleton instance;
export const redis.Instrumentation = new Redis.Instrumentation()// Export convenience functions;
export const instrument.Redis = (client: any) => redisInstrumentationinstrumentRedis.Client(client);
export const withCache.Span = <T>(operation: Cache.Operation, fn: () => Promise<T>) =>
  redisInstrumentationwithCache.Span(operation, fn);
export const wrapCache.Function = <T extends (.args: any[]) => Promise<unknown>>(
  fn: T;
  options: any) => redisInstrumentationwrapCache.Function(fn, options);
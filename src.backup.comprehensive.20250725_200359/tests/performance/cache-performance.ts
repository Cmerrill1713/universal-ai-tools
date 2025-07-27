import Redis from 'ioredis';
import { performance } from 'perf_hooks';
import { logger } from '././utils/logger';
import { Event.Emitter } from 'events';
export interface Cache.Metrics {
  operation: 'get' | 'set' | 'del' | 'exists' | 'expire' | 'scan',
  execution.Time: number,
  key.Size: number,
  value.Size: number,
  hit: boolean,
  success: boolean,
  error instanceof Error ? errormessage : String(error)  string;
  timestamp: number,
  concurrent.Operations: number,
}
export interface Cache.Performance.Result {
  metrics: Cache.Metrics[],
  aggregated.Metrics: {
    total.Operations: number,
    hit.Rate: number,
    average.Response.Time: number,
    operations.Per.Second: number,
    p95.Response.Time: number,
    p99.Response.Time: number,
    error.Rate: number,
    cache.Efficiency: number,
}  memory.Usage: {
    used: number,
    peak: number,
    key.Count: number,
    average.Key.Size: number,
    average.Value.Size: number,
}  eviction.Metrics: {
    evicted.Keys: number,
    eviction.Rate: number,
    memory.Pressure: number,
}  test.Duration: number,
}
export class Cache.Performance.Tester extends Event.Emitter {
  private redis: Redis,
  private metrics: Cache.Metrics[] = [],
  private active.Operations = 0;
  private is.Running = false;
  private test.Key.Prefix = 'perf_test:';
  constructor(redis.Config?: any) {
    super();
    thisredis = new Redis();
      redis.Config || {
        host: process.envREDIS_HO.S.T || 'localhost',
        port: parse.Int(process.envREDIS_PO.R.T || '6379', 10);
        retryDelay.On.Failover: 100,
        maxRetries.Per.Request: 3,
        lazy.Connect: true,
      });

  public async run.Performance.Test(options: {
    duration: number// seconds,
    concurrent.Operations: number,
    operation.Mix: {
      get: number,
      set: number,
      del: number,
      exists: number,
}    data.Size: 'small' | 'medium' | 'large',
    key.Count: number}): Promise<Cache.Performance.Result> {
    loggerinfo('Starting cache performance test.', options);
    thisis.Running = true;
    this.metrics = [];
    const start.Time = performancenow();
    try {
      // Setup test data;
      await thissetup.Test.Data(optionskey.Count, optionsdata.Size)// Run concurrent operations;
      const test.Promises: Promise<void>[] = [],
      for (let i = 0; i < optionsconcurrent.Operations; i++) {
        const test.Promise = thisrun.Concurrent.Operations(
          optionsduration * 1000;
          optionsoperation.Mix;
          optionsdata.Size;
          optionskey.Count);
        test.Promisespush(test.Promise);

      await Promiseall(test.Promises);
      const end.Time = performancenow();
      const test.Duration = (end.Time - start.Time) / 1000// Get memory usage;
      const memory.Usage = await thisget.Memory.Usage()// Get eviction metrics;
      const eviction.Metrics = await thisget.Eviction.Metrics()// Calculate aggregated metrics;
      const aggregated.Metrics = thiscalculate.Aggregated.Metrics(test.Duration);
      const result: Cache.Performance.Result = {
        metrics: this.metrics,
        aggregated.Metrics;
        memory.Usage;
        eviction.Metrics;
        test.Duration;
}      loggerinfo('Cache performance test completed', {
        duration: test.Duration,
        total.Operations: resultaggregated.Metricstotal.Operations,
        hit.Rate: resultaggregated.Metricshit.Rate}),
      thisemit('test-completed', result);
      return result} catch (error) {
      loggererror('Cache performance test failed:', error instanceof Error ? errormessage : String(error);
      thisemit('test-failed', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)} finally {
      thisis.Running = false;
      await thiscleanup.Test.Data()};

  private async setup.Test.Data(
    key.Count: number,
    data.Size: 'small' | 'medium' | 'large'): Promise<void> {
    loggerinfo(`Setting up cache test data with ${key.Count} keys.`);
    const data.Sizes = {
      small: 100, // 100 bytes;
      medium: 1024, // 1K.B;
      large: 10240, // 10K.B;
    const value.Size = data.Sizes[data.Size];
    const batch.Size = 1000;
    const batches = Mathceil(key.Count / batch.Size);
    for (let batch = 0; batch < batches; batch++) {
      const pipeline = thisredispipeline();
      const start.Idx = batch * batch.Size;
      const end.Idx = Math.min(start.Idx + batch.Size, key.Count);
      for (let i = start.Idx; i < end.Idx; i++) {
        const key = `${thistest.Key.Prefix}key_${i}`;
        const value = thisgenerate.Test.Data(value.Size, i);
        pipelineset(key, value)// Set expiration for some keys to test eviction;
        if (i % 10 === 0) {
          pipelineexpire(key, 3600)// 1 hour};

      await pipelineexec();

    loggerinfo(`Cache test data setup completed with ${key.Count} keys`);

  private generate.Test.Data(size: number, seed: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWX.Y.Zabcdefghijklmnopqrstuvwxyz0123456789';
    let result = `test_data_${seed}_`;
    while (resultlength < size) {
      result += charschar.At(Mathfloor(Mathrandom() * charslength));

    return resultsubstring(0, size);

  private async run.Concurrent.Operations(
    duration: number,
    operation.Mix: { get: number; set: number; del: number; exists: number ,
    data.Size: 'small' | 'medium' | 'large',
    key.Count: number): Promise<void> {
    const end.Time = Date.now() + duration;
    const operations = thisbuild.Operation.Array(operation.Mix);
    while (Date.now() < end.Time && thisis.Running) {
      const operation = operations[Mathfloor(Mathrandom() * operationslength)];
      try {
        await thisexecute.Operation(operation, data.Size, key.Count)} catch (error) {
        // Error already logged in execute.Operation}// Small delay to avoid overwhelming Redis;
      await new Promise((resolve) => set.Timeout(resolve, Mathrandom() * 10))};

  private build.Operation.Array(operation.Mix: {
    get: number,
    set: number,
    del: number,
    exists: number}): string[] {
    const operations: string[] = []// Build weighted array based on operation mix percentages,
    Objectentries(operation.Mix)for.Each(([operation, percentage]) => {
      for (let i = 0; i < percentage; i++) {
        operationspush(operation)}});
    return operations;

  private async execute.Operation(
    operation: string,
    data.Size: 'small' | 'medium' | 'large',
    key.Count: number): Promise<void> {
    const start.Time = performancenow();
    thisactive.Operations++
    try {
      let result: any,
      let hit = false;
      let key.Size = 0;
      let value.Size = 0;
      const random.Key.Id = Mathfloor(Mathrandom() * key.Count);
      const key = `${thistest.Key.Prefix}key_${random.Key.Id}`;
      key.Size = Bufferbyte.Length(key, 'utf8');
      switch (operation) {
        case 'get':
          result = await thisredisget(key);
          hit = result !== null;
          value.Size = result ? Bufferbyte.Length(result, 'utf8') : 0;
          break;
        case 'set':
          const data.Sizes = { small: 100, medium: 1024, large: 10240 ,
          const value = thisgenerate.Test.Data(data.Sizes[data.Size], random.Key.Id);
          value.Size = Bufferbyte.Length(value, 'utf8');
          result = await thisredisset(key, value);
          hit = false// Set operations don't have hits;
          break;
        case 'del':
          result = await thisredisdel(key);
          hit = result === 1;
          break;
        case 'exists':
          result = await thisredisexists(key);
          hit = result === 1;
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`),

      const end.Time = performancenow();
      const metrics: Cache.Metrics = {
        operation: operation as any,
        execution.Time: end.Time - start.Time,
        key.Size;
        value.Size;
        hit;
        success: true,
        timestamp: Date.now(),
        concurrent.Operations: thisactive.Operations,
}      this.metricspush(metrics);
      thisemit('operation-completed', metrics)} catch (error) {
      const end.Time = performancenow();
      const metrics: Cache.Metrics = {
        operation: operation as any,
        execution.Time: end.Time - start.Time,
        key.Size: 0,
        value.Size: 0,
        hit: false,
        success: false,
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error);
        timestamp: Date.now(),
        concurrent.Operations: thisactive.Operations,
}      this.metricspush(metrics);
      thisemit('operation-failed', metrics)} finally {
      thisactive.Operations--};

  private async get.Memory.Usage(): Promise<{
    used: number,
    peak: number,
    key.Count: number,
    average.Key.Size: number,
    average.Value.Size: number}> {
    try {
      const info = await thisredisinfo('memory');
      const key.Count = await thisredisdbsize()// Parse memory info;
      const memory.Used = thisparse.Info.Value(info, 'used_memory');
      const memory.Peak = thisparse.Info.Value(info, 'used_memory_peak')// Calculate average sizes from our metrics;
      const set.Operations = this.metricsfilter((m) => moperation === 'set' && msuccess);
      const average.Key.Size =
        set.Operationslength > 0? set.Operationsreduce((sum, m) => sum + mkey.Size, 0) / set.Operationslength: 0,
      const average.Value.Size =
        set.Operationslength > 0? set.Operationsreduce((sum, m) => sum + mvalue.Size, 0) / set.Operationslength: 0,
      return {
        used: memory.Used,
        peak: memory.Peak,
        key.Count;
        average.Key.Size;
        average.Value.Size;
      }} catch (error) {
      loggererror('Failed to get memory usage:', error instanceof Error ? errormessage : String(error);
      return {
        used: 0,
        peak: 0,
        key.Count: 0,
        average.Key.Size: 0,
        average.Value.Size: 0,
      }};

  private async get.Eviction.Metrics(): Promise<{
    evicted.Keys: number,
    eviction.Rate: number,
    memory.Pressure: number}> {
    try {
      const info = await thisredisinfo('stats');
      const evicted.Keys = thisparse.Info.Value(info, 'evicted_keys')// Calculate eviction rate (evictions per operation);
      const eviction.Rate = this.metricslength > 0 ? evicted.Keys / this.metricslength : 0// Memory pressure approximation;
      const memory.Info = await thisredisinfo('memory');
      const used.Memory = thisparse.Info.Value(memory.Info, 'used_memory');
      const max.Memory = thisparse.Info.Value(memory.Info, 'maxmemory');
      const memory.Pressure = max.Memory > 0 ? (used.Memory / max.Memory) * 100 : 0;
      return {
        evicted.Keys;
        eviction.Rate;
        memory.Pressure}} catch (error) {
      loggererror('Failed to get eviction metrics:', error instanceof Error ? errormessage : String(error);
      return {
        evicted.Keys: 0,
        eviction.Rate: 0,
        memory.Pressure: 0,
      }};

  private parse.Info.Value(info: string, key: string): number {
    const match = infomatch(new Reg.Exp(`${key}:(\\d+)`));
    return match ? parse.Int(match[1], 10, 10) : 0;

  private calculate.Aggregated.Metrics(test.Duration: number) {
    const successful.Ops = this.metricsfilter((m) => msuccess);
    const get.Operations = successful.Opsfilter((m) => moperation === 'get');
    const response.Times = successful.Opsmap((m) => mexecution.Time);
    response.Timessort((a, b) => a - b);
    const hit.Rate =
      get.Operationslength > 0? (get.Operationsfilter((op) => ophit)length / get.Operationslength) * 100: 0;
    const total.Data.Transferred = successful.Opsreduce((sum, m) => sum + mkey.Size + mvalue.Size, 0);
    const cache.Efficiency = total.Data.Transferred / this.metricslength// bytes per operation;

    return {
      total.Operations: this.metricslength,
      hit.Rate;
      average.Response.Time:
        response.Timesreduce((sum, time) => sum + time, 0) / response.Timeslength || 0;
      operations.Per.Second: this.metricslength / test.Duration,
      p95.Response.Time: thiscalculate.Percentile(response.Times, 95);
      p99.Response.Time: thiscalculate.Percentile(response.Times, 99);
      error.Rate: ((this.metricslength - successful.Opslength) / this.metricslength) * 100 || 0,
      cache.Efficiency;
    };

  private calculate.Percentile(sorted.Array: number[], percentile: number): number {
    if (sorted.Arraylength === 0) return 0;
    const index = (percentile / 100) * (sorted.Arraylength - 1);
    const lower = Mathfloor(index);
    const upper = Mathceil(index);
    if (lower === upper) {
      return sorted.Array[lower];

    return sorted.Array[lower] + (sorted.Array[upper] - sorted.Array[lower]) * (index - lower);

  private async cleanup.Test.Data(): Promise<void> {
    try {
      const keys = await thisrediskeys(`${thistest.Key.Prefix}*`);
      if (keyslength > 0) {
        await thisredisdel(.keys);
      loggerinfo(`Cleaned up ${keyslength} test keys`)} catch (error) {
      loggererror('Failed to cleanup test data:', error instanceof Error ? errormessage : String(error)  };

  public stop(): void {
    thisis.Running = false;
    thisemit('test-stopped');
}
  public async disconnect(): Promise<void> {
    await thisredisdisconnect();
  }}// Cache consistency test under load;
export async function test.Cache.Consistency(
  redis: Redis,
  options: {
    duration: number,
    concurrent.Writers: number,
    concurrent.Readers: number,
  }): Promise<{
  consistency.Errors: number,
  total.Operations: number,
  consistency.Rate: number}> {
  const test.Key = 'consistency_test_key';
  const expected.Value = 'consistent_value';
  let total.Operations = 0;
  let consistency.Errors = 0;
  let is.Running = true// Set initial value;
  await redisset(test.Key, expected.Value);
  const writer.Promises: Promise<void>[] = [],
  const reader.Promises: Promise<void>[] = []// Start writers,
  for (let i = 0; i < optionsconcurrent.Writers; i++) {
    writer.Promisespush(
      (async () => {
        const end.Time = Date.now() + optionsduration * 1000;
        while (Date.now() < end.Time && is.Running) {
          await redisset(test.Key, expected.Value);
          total.Operations++
          await new Promise((resolve) => set.Timeout(resolve, Mathrandom() * 10))}})())}// Start readers;
  for (let i = 0; i < optionsconcurrent.Readers; i++) {
    reader.Promisespush(
      (async () => {
        const end.Time = Date.now() + optionsduration * 1000;
        while (Date.now() < end.Time && is.Running) {
          const value = await redisget(test.Key);
          total.Operations++
          if (value !== expected.Value && value !== null) {
            consistency.Errors++;
          await new Promise((resolve) => set.Timeout(resolve, Mathrandom() * 5))}})());

  await Promiseall([.writer.Promises, .reader.Promises]);
  is.Running = false// Cleanup;
  await redisdel(test.Key);
  const consistency.Rate =
    total.Operations > 0 ? ((total.Operations - consistency.Errors) / total.Operations) * 100 : 100;
  return {
    consistency.Errors;
    total.Operations;
    consistency.Rate};

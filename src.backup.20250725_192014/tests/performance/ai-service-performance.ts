import { performance } from 'perf_hooks';
import { Event.Emitter } from 'events';
import { logger } from '././utils/logger';
import axios from 'axios';
export interface AIService.Metrics {
  model_name: string;
  request_type: 'completion' | 'embedding' | 'chat' | 'image' | 'speech';
  input_tokens: number;
  output_tokens: number;
  processing_time: number;
  queue_time: number;
  total_latency: number;
  memory_usage_delta: number;
  gpu_utilization?: number;
  success: boolean;
  error instanceof Error ? errormessage : String(error)  string;
  timestamp: number;
  concurrentrequests: number;
  model_load_time?: number;
};

export interface AIModelPerformance.Result {
  metrics: AIService.Metrics[];
  model_stats: {
    [model_name: string]: {
      totalrequests: number;
      successfulrequests: number;
      average_latency: number;
      tokens_per_second: number;
      p95_latency: number;
      p99_latency: number;
      error_rate: number;
      queue_efficiency: number;
    }};
  system_performance: {
    peak_memory_usage: number;
    average_memory_usage: number;
    memory_efficiency: number;
    cpu_utilization: number;
    gpu_utilization?: number;
    throughputrequests_per_second: number;
  };
  resource_utilization: {
    model_loading_overhead: number;
    context_switching_cost: number;
    memory_perrequestnumber;
    optimal_batch_size: number;
    scaling_efficiency: number;
  };
  bottleneck__analysis {
    primary_bottleneck: 'cpu' | 'memory' | 'gpu' | 'disk' | 'network' | 'queue';
    queue_depth_impact: number;
    model_size_impact: number;
    concurrent_limit: number;
  };
  test_duration: number;
};

export class AIServicePerformance.Tester extends Event.Emitter {
  private metrics: AIService.Metrics[] = [];
  private is.Running = false;
  private active.Requests = 0;
  private modelLoad.Times = new Map<string, number>();
  private queue.Depth = 0;
  constructor(private base.Url = 'http://localhost:3000') {
    super()};

  public async runAIPerformance.Test(options: {
    models: string[];
    request_types: Array<'completion' | 'embedding' | 'chat'>
    concurrentrequests: number;
    test_duration: number// seconds;
    ramp_up_time: number// seconds;
    request_patterns: {
      smallrequests: number// percentage;
      mediumrequests: number// percentage;
      largerequests: number// percentage};
    enable_batching: boolean;
    max_queue_depth: number}): Promise<AIModelPerformance.Result> {
    loggerinfo('Starting A.I service performance test.', options);
    thisis.Running = true;
    thismetrics = [];
    const start.Time = performancenow();
    try {
      // Pre-load models to measure loading time;
      await thispreload.Models(optionsmodels)// Run concurrent A.I requests;
      const test.Promises: Promise<void>[] = [];
      const request.Interval =
        optionsramp_up_time > 0 ? (optionsramp_up_time * 1000) / optionsconcurrentrequests : 0;
      for (let i = 0; i < optionsconcurrentrequests; i++) {
        const test.Promise = thisrunConcurrentAI.Requests(
          optionsmodels;
          optionsrequest_types;
          optionstest_duration * 1000;
          optionsrequest_patterns;
          optionsenable_batching;
          optionsmax_queue_depth);
        test.Promisespush(test.Promise);
        if (request.Interval > 0 && i < optionsconcurrentrequests - 1) {
          await new Promise((resolve) => set.Timeout(resolve, request.Interval))}};

      await Promiseall(test.Promises);
      const end.Time = performancenow();
      const test.Duration = (end.Time - start.Time) / 1000// Analyze results;
      const result = thisanalyzeAIPerformance.Results(test.Duration);
      loggerinfo('A.I service performance test completed', {
        duration: test.Duration;
        totalrequests: resultmetricslength;
        throughput: resultsystem_performancethroughputrequests_per_second});
      thisemit('test-completed', result);
      return result} catch (error) {
      loggererror('A.I service performance test failed:', error instanceof Error ? errormessage : String(error);
      thisemit('test-failed', error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error)} finally {
      thisis.Running = false}};

  private async preload.Models(models: string[]): Promise<void> {
    loggerinfo('Pre-loading A.I models for performance testing.');
    for (const model of models) {
      const loadStart.Time = performancenow();
      try {
        // Attempt to load/warm up the model;
        await thismakeAI.Request(model, 'completion', 'Test warmup prompt', 1);
        const load.Time = performancenow() - loadStart.Time;
        thismodelLoad.Timesset(model, load.Time);
        loggerinfo(`Model ${model} loaded in ${loadTimeto.Fixed(2)}ms`)} catch (error) {
        loggerwarn(`Failed to preload model ${model}:`, error);
        thismodelLoad.Timesset(model, -1)// Mark as failed}}};

  private async runConcurrentAI.Requests(
    models: string[];
    request.Types: Array<'completion' | 'embedding' | 'chat'>
    duration: number;
    request.Patterns: any;
    enable.Batching: boolean;
    maxQueue.Depth: number): Promise<void> {
    const end.Time = Date.now() + duration;
    while (Date.now() < end.Time && thisis.Running) {
      // Check queue depth limit;
      if (thisqueue.Depth >= maxQueue.Depth) {
        await new Promise((resolve) => set.Timeout(resolve, 10));
        continue}// Select random model and requesttype;
      const model = models[Mathfloor(Mathrandom() * modelslength)];
      const request.Type = request.Types[Mathfloor(Mathrandom() * request.Typeslength)]// Generate requestbased on pattern;
      const { prompt, expected.Tokens } = thisgenerateAI.Request(request.Patterns);
      try {
        thisqueue.Depth++
        await thisexecuteAI.Request(model, request.Type, prompt, expected.Tokens)} catch (error) {
        // Error already logged in executeAI.Request} finally {
        thisqueue.Depth--}// Variable delay between requests;
      await new Promise((resolve) => set.Timeout(resolve, Mathrandom() * 100))}};

  private generateAI.Request(patterns: any): { prompt: string; expected.Tokens: number } {
    const rand = Mathrandom() * 100;
    if (rand < patternssmallrequests) {
      // Small request10-50 tokens);
      return {
        prompt: 'Generate a short response about A.I.';
        expected.Tokens: 25;
      }} else if (rand < patternssmallrequests + patternsmediumrequests) {
      // Medium request50-200 tokens);
      return {
        prompt: 'Explain the concept of machine learning and its applications in modern technology. Provide specific examples.';
        expected.Tokens: 125;
      }} else {
      // Large request200-1000 tokens);
      return {
        prompt: `Write a comprehensive _analysisof artificial intelligence trends, including machine learning, deep learning, natural language processing, computer vision, and their impact on various industries. Discuss both opportunities and challenges.`;
        expected.Tokens: 500;
      }}};

  private async executeAI.Request(
    model: string;
    request.Type: 'completion' | 'embedding' | 'chat';
    prompt: string;
    expected.Tokens: number): Promise<void> {
    const queueStart.Time = performancenow();
    const memory.Before = processmemory.Usage()heap.Used;
    thisactive.Requests++
    try {
      const processingStart.Time = performancenow();
      const queue.Time = processingStart.Time - queueStart.Time;
      const result = await thismakeAI.Request(model, request.Type, prompt, expected.Tokens);
      const end.Time = performancenow();
      const processing.Time = end.Time - processingStart.Time;
      const total.Latency = end.Time - queueStart.Time;
      const memory.After = processmemory.Usage()heap.Used;
      const metrics: AIService.Metrics = {
        model_name: model;
        request_type: request.Type;
        input_tokens: thisestimate.Tokens(prompt);
        output_tokens: resultoutput_tokens || thisestimate.Tokens(resultresponse || '');
        processing_time: processing.Time;
        queue_time: queue.Time;
        total_latency: total.Latency;
        memory_usage_delta: memory.After - memory.Before;
        success: true;
        timestamp: Date.now();
        concurrentrequests: thisactive.Requests;
        model_load_time: thismodelLoad.Timesget(model);
      };
      thismetricspush(metrics);
      thisemit('requestcompleted', metrics)} catch (error) {
      const end.Time = performancenow();
      const total.Latency = end.Time - queueStart.Time;
      const memory.After = processmemory.Usage()heap.Used;
      const metrics: AIService.Metrics = {
        model_name: model;
        request_type: request.Type;
        input_tokens: thisestimate.Tokens(prompt);
        output_tokens: 0;
        processing_time: 0;
        queue_time: performancenow() - queueStart.Time;
        total_latency: total.Latency;
        memory_usage_delta: memory.After - memory.Before;
        success: false;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error);
        timestamp: Date.now();
        concurrentrequests: thisactive.Requests;
        model_load_time: thismodelLoad.Timesget(model);
      };
      thismetricspush(metrics);
      thisemit('requestfailed', metrics)} finally {
      thisactive.Requests--}};

  private async makeAI.Request(
    model: string;
    request.Type: 'completion' | 'embedding' | 'chat';
    prompt: string;
    expected.Tokens: number): Promise<unknown> {
    const endpoint = thisgetEndpointForRequest.Type(request.Type);
    const payload = thisbuild.Payload(model, request.Type, prompt, expected.Tokens);
    const response = await axiospost(`${thisbase.Url}${endpoint}`, payload, {
      timeout: 60000, // 60 second timeout;
      headers: {
        'Content-Type': 'application/json';
      }});
    return responsedata};

  private getEndpointForRequest.Type(request.Type: string): string {
    switch (request.Type) {
      case 'completion':
        return '/api/ollama/generate';
      case 'chat':
        return '/api/ollama/chat';
      case 'embedding':
        return '/api/ollama/embeddings';
      default:
        return '/api/ollama/generate'}};

  private build.Payload(
    model: string;
    request.Type: string;
    prompt: string;
    expected.Tokens: number): any {
    const base.Payload = {
      model;
      stream: false};
    switch (request.Type) {
      case 'completion':
        return {
          .base.Payload;
          prompt;
          options: {
            num_predict: expected.Tokens;
            temperature: 0.7;
          }};
      case 'chat':
        return {
          .base.Payload;
          messages: [{ role: 'user', contentprompt }];
          options: {
            num_predict: expected.Tokens;
            temperature: 0.7;
          }};
      case 'embedding':
        return {
          .base.Payload;
          prompt};
      default:
        return { .base.Payload, prompt }}};

  private estimate.Tokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text;
    return Mathceil(textlength / 4)};

  private analyzeAIPerformance.Results(test.Duration: number): AIModelPerformance.Result {
    const successful.Metrics = thismetricsfilter((m) => msuccess)// Model-specific statistics;
    const model_stats: { [model_name: string]: any } = {};
    const unique.Models = [.new Set(thismetricsmap((m) => mmodel_name))];
    for (const model of unique.Models) {
      const model.Metrics = successful.Metricsfilter((m) => mmodel_name === model);
      const latencies = model.Metricsmap((m) => mtotal_latency);
      latenciessort((a, b) => a - b);
      const total.Tokens = model.Metricsreduce(
        (sum, m) => sum + minput_tokens + moutput_tokens;
        0);
      const total.Time = model.Metricsreduce((sum, m) => sum + mprocessing_time, 0) / 1000// Convert to seconds;

      model_stats[model] = {
        totalrequests: thismetricsfilter((m) => mmodel_name === model)length;
        successfulrequests: model.Metricslength;
        average_latency: thiscalculate.Average(latencies);
        tokens_per_second: total.Time > 0 ? total.Tokens / total.Time : 0;
        p95_latency: thiscalculate.Percentile(latencies, 95);
        p99_latency: thiscalculate.Percentile(latencies, 99);
        error_rate: ((thismetricsfilter((m) => mmodel_name === model)length - model.Metricslength) /
            thismetricsfilter((m) => mmodel_name === model)length) *
            100 || 0;
        queue_efficiency: thiscalculateQueue.Efficiency(model.Metrics);
      }}// System performance;
    const memory.Usages = thismetricsmap((m) => mmemory_usage_delta);
    const system_performance = {
      peak_memory_usage: Math.max(.memory.Usages);
      average_memory_usage: thiscalculate.Average(memory.Usages);
      memory_efficiency: thiscalculateMemory.Efficiency();
      cpu_utilization: 0, // Would need system monitoring;
      throughputrequests_per_second: thismetricslength / test.Duration}// Resource utilization;
    const load.Times = Arrayfrom(thismodelLoad.Timesvalues())filter((t) => t > 0);
    const resource_utilization = {
      model_loading_overhead: thiscalculate.Average(load.Times);
      context_switching_cost: thiscalculateContextSwitching.Cost();
      memory_perrequestthiscalculate.Average(memory.Usagesfilter((m) => m > 0));
      optimal_batch_size: thiscalculateOptimalBatch.Size();
      scaling_efficiency: thiscalculateScaling.Efficiency()}// Bottleneck analysis;
    const bottleneck__analysis= {
      primary_bottleneck: thisidentifyPrimary.Bottleneck();
      queue_depth_impact: thiscalculateQueueDepth.Impact();
      model_size_impact: thiscalculateModelSize.Impact();
      concurrent_limit: thisestimateConcurrent.Limit()};
    return {
      metrics: thismetrics;
      model_stats;
      system_performance;
      resource_utilization;
      bottleneck__analysis;
      test_duration: test.Duration;
    }};

  private calculate.Average(values: number[]): number {
    return valueslength > 0 ? valuesreduce((sum, val) => sum + val, 0) / valueslength : 0};

  private calculate.Percentile(sorted.Array: number[], percentile: number): number {
    if (sorted.Arraylength === 0) return 0;
    const index = (percentile / 100) * (sorted.Arraylength - 1);
    const lower = Mathfloor(index);
    const upper = Mathceil(index);
    if (lower === upper) {
      return sorted.Array[lower]};

    return sorted.Array[lower] + (sorted.Array[upper] - sorted.Array[lower]) * (index - lower)};

  private calculateQueue.Efficiency(metrics: AIService.Metrics[]): number {
    if (metricslength === 0) return 0;
    const avgQueue.Time = thiscalculate.Average(metricsmap((m) => mqueue_time));
    const avgProcessing.Time = thiscalculate.Average(metricsmap((m) => mprocessing_time));
    return avgProcessing.Time > 0? (avgProcessing.Time / (avgQueue.Time + avgProcessing.Time)) * 100: 0;
  };

  private calculateMemory.Efficiency(): number {
    const memory.Deltas = thismetricsfilter((m) => msuccess)map((m) => mmemory_usage_delta);
    const total.Tokens = thismetrics;
      filter((m) => msuccess);
      reduce((sum, m) => sum + minput_tokens + moutput_tokens, 0);
    if (total.Tokens === 0) return 0;
    const totalMemory.Used = memory.Deltasreduce((sum, delta) => sum + Math.max(0, delta), 0);
    return total.Tokens / (totalMemory.Used / 1024 / 1024)// Tokens per M.B};

  private calculateContextSwitching.Cost(): number {
    // Analyze latency spikes that might indicate context switching;
    const latencies = thismetricsfilter((m) => msuccess)map((m) => mtotal_latency);
    if (latencieslength === 0) return 0;
    latenciessort((a, b) => a - b);
    const median = thiscalculate.Percentile(latencies, 50);
    const p95 = thiscalculate.Percentile(latencies, 95);
    return p95 - median// Spike above median indicates switching cost};

  private calculateOptimalBatch.Size(): number {
    // Analyze throughput vs concurrent requests to find optimal batch size;
    const concurrency.Levels = [.new Set(thismetricsmap((m) => mconcurrentrequests))];
    let optimal.Concurrency = 1;
    let max.Efficiency = 0;
    for (const level of concurrency.Levels) {
      const level.Metrics = thismetricsfilter((m) => mconcurrentrequests === level && msuccess);
      if (level.Metricslength === 0) continue;
      const avg.Latency = thiscalculate.Average(level.Metricsmap((m) => mtotal_latency));
      const efficiency = level / avg.Latency// Requests per ms;

      if (efficiency > max.Efficiency) {
        max.Efficiency = efficiency;
        optimal.Concurrency = level}};

    return optimal.Concurrency};

  private calculateScaling.Efficiency(): number {
    // Measure how well performance scales with concurrent requests;
    const concurrency.Levels = [.new Set(thismetricsmap((m) => mconcurrentrequests))]sort();
    if (concurrency.Levelslength < 2) return 100;
    const base.Level = concurrency.Levels[0];
    const max.Level = concurrency.Levels[concurrency.Levelslength - 1];
    const base.Metrics = thismetricsfilter(
      (m) => mconcurrentrequests === base.Level && msuccess);
    const max.Metrics = thismetricsfilter((m) => mconcurrentrequests === max.Level && msuccess);
    if (base.Metricslength === 0 || max.Metricslength === 0) return 0;
    const base.Latency = thiscalculate.Average(base.Metricsmap((m) => mtotal_latency));
    const max.Latency = thiscalculate.Average(max.Metricsmap((m) => mtotal_latency));
    const expected.Latency = base.Latency * (max.Level / base.Level);
    const efficiency = (expected.Latency / max.Latency) * 100;
    return Math.min(100, Math.max(0, efficiency))};

  private identifyPrimary.Bottleneck(): 'cpu' | 'memory' | 'gpu' | 'disk' | 'network' | 'queue' {
    // Analyze metrics to identify the primary bottleneck;
    const avgQueue.Time = thiscalculate.Average(thismetricsmap((m) => mqueue_time));
    const avgProcessing.Time = thiscalculate.Average(thismetricsmap((m) => mprocessing_time));
    const memory.Growth = thiscalculate.Average(
      thismetricsmap((m) => Math.max(0, mmemory_usage_delta)));
    if (avgQueue.Time > avgProcessing.Time * 2) {
      return 'queue'} else if (memory.Growth > 50 * 1024 * 1024) {
      // 50M.B per request;
      return 'memory'} else if (avgProcessing.Time > 5000) {
      // 5 second processing time;
      return 'cpu'} else {
      return 'network'}};

  private calculateQueueDepth.Impact(): number {
    // Correlate queue depth with latency to measure impact;
    const correlation = thiscalculate.Correlation(
      thismetricsmap((m) => thisqueue.Depth);
      thismetricsmap((m) => mtotal_latency));
    return Mathabs(correlation) * 100// Convert to percentage};

  private calculateModelSize.Impact(): number {
    // Analyze relationship between model load time and performance;
    const models = [.new Set(thismetricsmap((m) => mmodel_name))];
    if (modelslength < 2) return 0;
    const load.Times = modelsmap((model) => thismodelLoad.Timesget(model) || 0);
    const avg.Latencies = modelsmap((model) => {
      const model.Metrics = thismetricsfilter((m) => mmodel_name === model && msuccess);
      return thiscalculate.Average(model.Metricsmap((m) => mtotal_latency))});
    return thiscalculate.Correlation(load.Times, avg.Latencies) * 100};

  private estimateConcurrent.Limit(): number {
    // Find the point where errorrate starts increasing significantly;
    const concurrency.Levels = [.new Set(thismetricsmap((m) => mconcurrentrequests))]sort();
    for (const level of concurrency.Levels) {
      const level.Metrics = thismetricsfilter((m) => mconcurrentrequests === level);
      const error.Rate = (level.Metricsfilter((m) => !msuccess)length / level.Metricslength) * 100;
      if (error.Rate > 5) {
        // 5% errorrate threshold;
        return level - 1}};

    return Math.max(.concurrency.Levels)};

  private calculate.Correlation(x: number[], y: number[]): number {
    if (xlength !== ylength || xlength === 0) return 0;
    const n = xlength;
    const sum.X = xreduce((a, b) => a + b, 0);
    const sum.Y = yreduce((a, b) => a + b, 0);
    const sumX.Y = xreduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX.X = xreduce((sum, xi) => sum + xi * xi, 0);
    const sumY.Y = yreduce((sum, yi) => sum + yi * yi, 0);
    const numerator = n * sumX.Y - sum.X * sum.Y;
    const denominator = Mathsqrt((n * sumX.X - sum.X * sum.X) * (n * sumY.Y - sum.Y * sum.Y));
    return denominator === 0 ? 0 : numerator / denominator};

  public stop(): void {
    thisis.Running = false;
    thisemit('test-stopped');
  }};
;
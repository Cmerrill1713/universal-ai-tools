import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import axios from 'axios';

export interface AIServiceMetrics {
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
  error?: string;
  timestamp: number;
  concurrent_requests: number;
  model_load_time?: number;
}

export interface AIModelPerformanceResult {
  metrics: AIServiceMetrics[];
  model_stats: {
    [model_name: string]: {
      total_requests: number;
      successful_requests: number;
      average_latency: number;
      tokens_per_second: number;
      p95_latency: number;
      p99_latency: number;
      error_rate: number;
      queue_efficiency: number;
    };
  };
  system_performance: {
    peak_memory_usage: number;
    average_memory_usage: number;
    memory_efficiency: number;
    cpu_utilization: number;
    gpu_utilization?: number;
    throughput_requests_per_second: number;
  };
  resource_utilization: {
    model_loading_overhead: number;
    context_switching_cost: number;
    memory_per_request: number;
    optimal_batch_size: number;
    scaling_efficiency: number;
  };
  bottleneck_analysis: {
    primary_bottleneck: 'cpu' | 'memory' | 'gpu' | 'disk' | 'network' | 'queue';
    queue_depth_impact: number;
    model_size_impact: number;
    concurrent_limit: number;
  };
  test_duration: number;
}

export class AIServicePerformanceTester extends EventEmitter {
  private metrics: AIServiceMetrics[] = [];
  private isRunning = false;
  private activeRequests = 0;
  private modelLoadTimes = new Map<string, number>();
  private queueDepth = 0;

  constructor(private baseUrl = 'http://localhost:3000') {
    super();
  }

  public async runAIPerformanceTest(options: {
    models: string[];
    request_types: Array<'completion' | 'embedding' | 'chat'>;
    concurrent_requests: number;
    test_duration: number; // seconds
    ramp_up_time: number; // seconds
    request_patterns: {
      small_requests: number; // percentage
      medium_requests: number; // percentage
      large_requests: number; // percentage
    };
    enable_batching: boolean;
    max_queue_depth: number;
  }): Promise<AIModelPerformanceResult> {

    logger.info('Starting AI service performance test...', options);
    this.isRunning = true;
    this.metrics = [];
    const startTime = performance.now();

    try {
      // Pre-load models to measure loading time
      await this.preloadModels(options.models);

      // Run concurrent AI requests
      const testPromises: Promise<void>[] = [];
      const requestInterval = options.ramp_up_time > 0 ? 
        (options.ramp_up_time * 1000) / options.concurrent_requests : 0;

      for (let i = 0; i < options.concurrent_requests; i++) {
        const testPromise = this.runConcurrentAIRequests(
          options.models,
          options.request_types,
          options.test_duration * 1000,
          options.request_patterns,
          options.enable_batching,
          options.max_queue_depth
        );
        testPromises.push(testPromise);

        if (requestInterval > 0 && i < options.concurrent_requests - 1) {
          await new Promise(resolve => setTimeout(resolve, requestInterval));
        }
      }

      await Promise.all(testPromises);

      const endTime = performance.now();
      const testDuration = (endTime - startTime) / 1000;

      // Analyze results
      const result = this.analyzeAIPerformanceResults(testDuration);

      logger.info('AI service performance test completed', {
        duration: testDuration,
        total_requests: result.metrics.length,
        throughput: result.system_performance.throughput_requests_per_second
      });

      this.emit('test-completed', result);
      return result;

    } catch (error) {
      logger.error('AI service performance test failed:', error);
      this.emit('test-failed', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  private async preloadModels(models: string[]): Promise<void> {
    logger.info('Pre-loading AI models for performance testing...');

    for (const model of models) {
      const loadStartTime = performance.now();
      
      try {
        // Attempt to load/warm up the model
        await this.makeAIRequest(model, 'completion', 'Test warmup prompt', 1);
        
        const loadTime = performance.now() - loadStartTime;
        this.modelLoadTimes.set(model, loadTime);
        
        logger.info(`Model ${model} loaded in ${loadTime.toFixed(2)}ms`);
      } catch (error) {
        logger.warn(`Failed to preload model ${model}:`, error);
        this.modelLoadTimes.set(model, -1); // Mark as failed
      }
    }
  }

  private async runConcurrentAIRequests(
    models: string[],
    requestTypes: Array<'completion' | 'embedding' | 'chat'>,
    duration: number,
    requestPatterns: any,
    enableBatching: boolean,
    maxQueueDepth: number
  ): Promise<void> {
    const endTime = Date.now() + duration;

    while (Date.now() < endTime && this.isRunning) {
      // Check queue depth limit
      if (this.queueDepth >= maxQueueDepth) {
        await new Promise(resolve => setTimeout(resolve, 10));
        continue;
      }

      // Select random model and request type
      const model = models[Math.floor(Math.random() * models.length)];
      const requestType = requestTypes[Math.floor(Math.random() * requestTypes.length)];
      
      // Generate request based on pattern
      const { prompt, expectedTokens } = this.generateAIRequest(requestPatterns);

      try {
        this.queueDepth++;
        await this.executeAIRequest(model, requestType, prompt, expectedTokens);
      } catch (error) {
        // Error already logged in executeAIRequest
      } finally {
        this.queueDepth--;
      }

      // Variable delay between requests
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    }
  }

  private generateAIRequest(patterns: any): { prompt: string; expectedTokens: number } {
    const rand = Math.random() * 100;
    
    if (rand < patterns.small_requests) {
      // Small request (10-50 tokens)
      return {
        prompt: 'Generate a short response about AI.',
        expectedTokens: 25
      };
    } else if (rand < patterns.small_requests + patterns.medium_requests) {
      // Medium request (50-200 tokens)
      return {
        prompt: 'Explain the concept of machine learning and its applications in modern technology. Provide specific examples.',
        expectedTokens: 125
      };
    } else {
      // Large request (200-1000 tokens)
      return {
        prompt: `Write a comprehensive analysis of artificial intelligence trends, including machine learning, deep learning, natural language processing, computer vision, and their impact on various industries. Discuss both opportunities and challenges.`,
        expectedTokens: 500
      };
    }
  }

  private async executeAIRequest(
    model: string,
    requestType: 'completion' | 'embedding' | 'chat',
    prompt: string,
    expectedTokens: number
  ): Promise<void> {
    const queueStartTime = performance.now();
    const memoryBefore = process.memoryUsage().heapUsed;
    
    this.activeRequests++;

    try {
      const processingStartTime = performance.now();
      const queueTime = processingStartTime - queueStartTime;

      const result = await this.makeAIRequest(model, requestType, prompt, expectedTokens);
      
      const endTime = performance.now();
      const processingTime = endTime - processingStartTime;
      const totalLatency = endTime - queueStartTime;
      const memoryAfter = process.memoryUsage().heapUsed;

      const metrics: AIServiceMetrics = {
        model_name: model,
        request_type: requestType,
        input_tokens: this.estimateTokens(prompt),
        output_tokens: result.output_tokens || this.estimateTokens(result.response || ''),
        processing_time: processingTime,
        queue_time: queueTime,
        total_latency: totalLatency,
        memory_usage_delta: memoryAfter - memoryBefore,
        success: true,
        timestamp: Date.now(),
        concurrent_requests: this.activeRequests,
        model_load_time: this.modelLoadTimes.get(model)
      };

      this.metrics.push(metrics);
      this.emit('request-completed', metrics);

    } catch (error) {
      const endTime = performance.now();
      const totalLatency = endTime - queueStartTime;
      const memoryAfter = process.memoryUsage().heapUsed;

      const metrics: AIServiceMetrics = {
        model_name: model,
        request_type: requestType,
        input_tokens: this.estimateTokens(prompt),
        output_tokens: 0,
        processing_time: 0,
        queue_time: performance.now() - queueStartTime,
        total_latency: totalLatency,
        memory_usage_delta: memoryAfter - memoryBefore,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        concurrent_requests: this.activeRequests,
        model_load_time: this.modelLoadTimes.get(model)
      };

      this.metrics.push(metrics);
      this.emit('request-failed', metrics);

    } finally {
      this.activeRequests--;
    }
  }

  private async makeAIRequest(
    model: string,
    requestType: 'completion' | 'embedding' | 'chat',
    prompt: string,
    expectedTokens: number
  ): Promise<any> {
    const endpoint = this.getEndpointForRequestType(requestType);
    const payload = this.buildPayload(model, requestType, prompt, expectedTokens);

    const response = await axios.post(`${this.baseUrl}${endpoint}`, payload, {
      timeout: 60000, // 60 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  private getEndpointForRequestType(requestType: string): string {
    switch (requestType) {
      case 'completion':
        return '/api/ollama/generate';
      case 'chat':
        return '/api/ollama/chat';
      case 'embedding':
        return '/api/ollama/embeddings';
      default:
        return '/api/ollama/generate';
    }
  }

  private buildPayload(model: string, requestType: string, prompt: string, expectedTokens: number): any {
    const basePayload = {
      model,
      stream: false
    };

    switch (requestType) {
      case 'completion':
        return {
          ...basePayload,
          prompt,
          options: {
            num_predict: expectedTokens,
            temperature: 0.7
          }
        };
      
      case 'chat':
        return {
          ...basePayload,
          messages: [
            { role: 'user', content: prompt }
          ],
          options: {
            num_predict: expectedTokens,
            temperature: 0.7
          }
        };
      
      case 'embedding':
        return {
          ...basePayload,
          prompt
        };
      
      default:
        return { ...basePayload, prompt };
    }
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  private analyzeAIPerformanceResults(testDuration: number): AIModelPerformanceResult {
    const successfulMetrics = this.metrics.filter(m => m.success);
    
    // Model-specific statistics
    const model_stats: { [model_name: string]: any } = {};
    
    const uniqueModels = [...new Set(this.metrics.map(m => m.model_name))];
    
    for (const model of uniqueModels) {
      const modelMetrics = successfulMetrics.filter(m => m.model_name === model);
      const latencies = modelMetrics.map(m => m.total_latency);
      latencies.sort((a, b) => a - b);
      
      const totalTokens = modelMetrics.reduce((sum, m) => sum + m.input_tokens + m.output_tokens, 0);
      const totalTime = modelMetrics.reduce((sum, m) => sum + m.processing_time, 0) / 1000; // Convert to seconds
      
      model_stats[model] = {
        total_requests: this.metrics.filter(m => m.model_name === model).length,
        successful_requests: modelMetrics.length,
        average_latency: this.calculateAverage(latencies),
        tokens_per_second: totalTime > 0 ? totalTokens / totalTime : 0,
        p95_latency: this.calculatePercentile(latencies, 95),
        p99_latency: this.calculatePercentile(latencies, 99),
        error_rate: ((this.metrics.filter(m => m.model_name === model).length - modelMetrics.length) / 
                    this.metrics.filter(m => m.model_name === model).length) * 100 || 0,
        queue_efficiency: this.calculateQueueEfficiency(modelMetrics)
      };
    }

    // System performance
    const memoryUsages = this.metrics.map(m => m.memory_usage_delta);
    const system_performance = {
      peak_memory_usage: Math.max(...memoryUsages),
      average_memory_usage: this.calculateAverage(memoryUsages),
      memory_efficiency: this.calculateMemoryEfficiency(),
      cpu_utilization: 0, // Would need system monitoring
      throughput_requests_per_second: this.metrics.length / testDuration
    };

    // Resource utilization
    const loadTimes = Array.from(this.modelLoadTimes.values()).filter(t => t > 0);
    const resource_utilization = {
      model_loading_overhead: this.calculateAverage(loadTimes),
      context_switching_cost: this.calculateContextSwitchingCost(),
      memory_per_request: this.calculateAverage(memoryUsages.filter(m => m > 0)),
      optimal_batch_size: this.calculateOptimalBatchSize(),
      scaling_efficiency: this.calculateScalingEfficiency()
    };

    // Bottleneck analysis
    const bottleneck_analysis = {
      primary_bottleneck: this.identifyPrimaryBottleneck(),
      queue_depth_impact: this.calculateQueueDepthImpact(),
      model_size_impact: this.calculateModelSizeImpact(),
      concurrent_limit: this.estimateConcurrentLimit()
    };

    return {
      metrics: this.metrics,
      model_stats,
      system_performance,
      resource_utilization,
      bottleneck_analysis,
      test_duration: testDuration
    };
  }

  private calculateAverage(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    return sortedArray[lower] + (sortedArray[upper] - sortedArray[lower]) * (index - lower);
  }

  private calculateQueueEfficiency(metrics: AIServiceMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const avgQueueTime = this.calculateAverage(metrics.map(m => m.queue_time));
    const avgProcessingTime = this.calculateAverage(metrics.map(m => m.processing_time));
    
    return avgProcessingTime > 0 ? (avgProcessingTime / (avgQueueTime + avgProcessingTime)) * 100 : 0;
  }

  private calculateMemoryEfficiency(): number {
    const memoryDeltas = this.metrics.filter(m => m.success).map(m => m.memory_usage_delta);
    const totalTokens = this.metrics.filter(m => m.success)
      .reduce((sum, m) => sum + m.input_tokens + m.output_tokens, 0);
    
    if (totalTokens === 0) return 0;
    
    const totalMemoryUsed = memoryDeltas.reduce((sum, delta) => sum + Math.max(0, delta), 0);
    return totalTokens / (totalMemoryUsed / 1024 / 1024); // Tokens per MB
  }

  private calculateContextSwitchingCost(): number {
    // Analyze latency spikes that might indicate context switching
    const latencies = this.metrics.filter(m => m.success).map(m => m.total_latency);
    if (latencies.length === 0) return 0;
    
    latencies.sort((a, b) => a - b);
    const median = this.calculatePercentile(latencies, 50);
    const p95 = this.calculatePercentile(latencies, 95);
    
    return p95 - median; // Spike above median indicates switching cost
  }

  private calculateOptimalBatchSize(): number {
    // Analyze throughput vs concurrent requests to find optimal batch size
    const concurrencyLevels = [...new Set(this.metrics.map(m => m.concurrent_requests))];
    let optimalConcurrency = 1;
    let maxEfficiency = 0;

    for (const level of concurrencyLevels) {
      const levelMetrics = this.metrics.filter(m => m.concurrent_requests === level && m.success);
      if (levelMetrics.length === 0) continue;

      const avgLatency = this.calculateAverage(levelMetrics.map(m => m.total_latency));
      const efficiency = level / avgLatency; // Requests per ms

      if (efficiency > maxEfficiency) {
        maxEfficiency = efficiency;
        optimalConcurrency = level;
      }
    }

    return optimalConcurrency;
  }

  private calculateScalingEfficiency(): number {
    // Measure how well performance scales with concurrent requests
    const concurrencyLevels = [...new Set(this.metrics.map(m => m.concurrent_requests))].sort();
    if (concurrencyLevels.length < 2) return 100;

    const baseLevel = concurrencyLevels[0];
    const maxLevel = concurrencyLevels[concurrencyLevels.length - 1];

    const baseMetrics = this.metrics.filter(m => m.concurrent_requests === baseLevel && m.success);
    const maxMetrics = this.metrics.filter(m => m.concurrent_requests === maxLevel && m.success);

    if (baseMetrics.length === 0 || maxMetrics.length === 0) return 0;

    const baseLatency = this.calculateAverage(baseMetrics.map(m => m.total_latency));
    const maxLatency = this.calculateAverage(maxMetrics.map(m => m.total_latency));

    const expectedLatency = baseLatency * (maxLevel / baseLevel);
    const efficiency = (expectedLatency / maxLatency) * 100;

    return Math.min(100, Math.max(0, efficiency));
  }

  private identifyPrimaryBottleneck(): 'cpu' | 'memory' | 'gpu' | 'disk' | 'network' | 'queue' {
    // Analyze metrics to identify the primary bottleneck
    const avgQueueTime = this.calculateAverage(this.metrics.map(m => m.queue_time));
    const avgProcessingTime = this.calculateAverage(this.metrics.map(m => m.processing_time));
    const memoryGrowth = this.calculateAverage(this.metrics.map(m => Math.max(0, m.memory_usage_delta)));

    if (avgQueueTime > avgProcessingTime * 2) {
      return 'queue';
    } else if (memoryGrowth > 50 * 1024 * 1024) { // 50MB per request
      return 'memory';
    } else if (avgProcessingTime > 5000) { // 5 second processing time
      return 'cpu';
    } else {
      return 'network';
    }
  }

  private calculateQueueDepthImpact(): number {
    // Correlate queue depth with latency to measure impact
    const correlation = this.calculateCorrelation(
      this.metrics.map(m => this.queueDepth),
      this.metrics.map(m => m.total_latency)
    );
    
    return Math.abs(correlation) * 100; // Convert to percentage
  }

  private calculateModelSizeImpact(): number {
    // Analyze relationship between model load time and performance
    const models = [...new Set(this.metrics.map(m => m.model_name))];
    if (models.length < 2) return 0;

    const loadTimes = models.map(model => this.modelLoadTimes.get(model) || 0);
    const avgLatencies = models.map(model => {
      const modelMetrics = this.metrics.filter(m => m.model_name === model && m.success);
      return this.calculateAverage(modelMetrics.map(m => m.total_latency));
    });

    return this.calculateCorrelation(loadTimes, avgLatencies) * 100;
  }

  private estimateConcurrentLimit(): number {
    // Find the point where error rate starts increasing significantly
    const concurrencyLevels = [...new Set(this.metrics.map(m => m.concurrent_requests))].sort();
    
    for (const level of concurrencyLevels) {
      const levelMetrics = this.metrics.filter(m => m.concurrent_requests === level);
      const errorRate = (levelMetrics.filter(m => !m.success).length / levelMetrics.length) * 100;
      
      if (errorRate > 5) { // 5% error rate threshold
        return level - 1;
      }
    }

    return Math.max(...concurrencyLevels);
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  public stop(): void {
    this.isRunning = false;
    this.emit('test-stopped');
  }
}
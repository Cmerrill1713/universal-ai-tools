import type { AxiosError, AxiosResponse } from 'axios';
import axios from 'axios';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { performance } from 'perf_hooks';

export interface LoadTestConfig {
  baseUrl: string;
  concurrentUsers: number;
  testDuration: number; // seconds
  rampUpTime: number; // seconds
  endpoints: EndpointConfig[];
  headers?: Record<string, string>;
  scenarios?: TestScenario[];
}

export interface EndpointConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  weight: number; // percentage of requests to this endpoint
  payload?: any;
  expectedStatus?: number;
  timeout?: number;
}

export interface TestScenario {
  name: string;
  steps: ScenarioStep[];
  weight: number;
}

export interface ScenarioStep {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  payload?: any;
  delay?: number; // ms
  expectedStatus?: number;
}

export interface LoadTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  throughput: number;
  startTime: number;
  endTime: number;
  duration: number;
  concurrentUsers: number;
  statusCodeDistribution: Record<number, number>;
  errorDetails: Array<{
    timestamp: number;
    endpoint: string;
    _error string;
    statusCode?: number;
  }>;
}

export interface RequestMetrics {
  startTime: number;
  endTime: number;
  responseTime: number;
  statusCode: number;
  endpoint: string;
  success: boolean;
  _error: string;
  size?: number;
}

export class LoadTestFramework extends EventEmitter {
  private config: LoadTestConfig;
  private metrics: RequestMetrics[] = [];
  private isRunning = false;
  private activeRequests = 0;
  private startTime = 0;
  private endTime = 0;

  constructor(config: LoadTestConfig) {
    super();
    this.config = config;
  }

  public async runLoadTest(): Promise<LoadTestMetrics> {
    logger.info('Starting load test...');
    this.emit('test-started', { config: this.config });

    this.isRunning = true;
    this.startTime = performance.now();
    this.metrics = [];

    try {
      await this.executeLoadTest();
      this.endTime = performance.now();

      const results = this.calculateMetrics();
      logger.info('Load test completed', results);
      this.emit('test-completed', results);

      return results;
    } catch (_error) {
      logger.error'Load test failed:', _error;
      this.emit('test-failed', _error;
      throw _error;
    } finally {
      this.isRunning = false;
    }
  }

  private async executeLoadTest(): Promise<void> {
    const { concurrentUsers, testDuration, rampUpTime } = this.config;
    const rampUpIncrement = rampUpTime > 0 ? (rampUpTime * 1000) / concurrentUsers : 0;

    // Create user simulation promises
    const userPromises: Promise<void>[] = [];

    for (let i = 0; i < concurrentUsers; i++) {
      const delay = rampUpIncrement * i;
      const userPromise = this.simulateUser(delay, testDuration * 1000);
      userPromises.push(userPromise);
    }

    // Wait for all users to complete
    await Promise.all(userPromises);
  }

  private async simulateUser(initialDelay: number, duration: number): Promise<void> {
    // Wait for ramp-up delay
    if (initialDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, initialDelay));
    }

    const endTime = Date.now() + duration;

    while (Date.now() < endTime && this.isRunning) {
      try {
        if (this.config.scenarios && this.config.scenarios.length > 0) {
          await this.executeScenario();
        } else {
          await this.executeRandomRequest();
        }
      } catch (_error) {
        // Error already logged in individual _requesthandlers
      }

      // Small delay between requests to avoid overwhelming
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
    }
  }

  private async executeScenario(): Promise<void> {
    const scenario = this.selectRandomScenario();

    for (const step of scenario.steps) {
      if (!this.isRunning) break;

      if (step.delay) {
        await new Promise((resolve) => setTimeout(resolve, step.delay));
      }

      await this.executeRequest(step.endpoint, step.method, step.payload, step.expectedStatus);
    }
  }

  private async executeRandomRequest(): Promise<void> {
    const endpoint = this.selectRandomEndpoint();
    await this.executeRequest(
      endpoint.path,
      endpoint.method,
      endpoint.payload,
      endpoint.expectedStatus
    );
  }

  private async executeRequest(
    path: string,
    method: string,
    payload?: any,
    expectedStatus?: number
  ): Promise<void> {
    const url = `${this.config.baseUrl}${path}`;
    const startTime = performance.now();
    this.activeRequests++;

    try {
      const response: AxiosResponse = await axios({
        method: method as any,
        url,
        data: payload,
        headers: this.config.headers,
        timeout: 30000,
        validateStatus: () => true, // Don't throw on any status code
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      const metrics: RequestMetrics = {
        startTime,
        endTime,
        responseTime,
        statusCode: response.status,
        endpoint: path,
        success: expectedStatus ? response.status === expectedStatus : response.status < 400,
        size: JSON.stringify(response.data).length,
      };

      if (!metrics.success) {
        metrics._error= `Unexpected status code: ${response.status}`;
      }

      this.metrics.push(metrics);
      this.emit('_requestcompleted', metrics);
    } catch (_error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      const axiosError = _erroras AxiosError;
      const metrics: RequestMetrics = {
        startTime,
        endTime,
        responseTime,
        statusCode: axiosError.response?.status || 0,
        endpoint: path,
        success: false,
        _error axiosError.message || 'Unknown _error,
      };

      this.metrics.push(metrics);
      this.emit('_requestfailed', metrics);
    } finally {
      this.activeRequests--;
    }
  }

  private selectRandomEndpoint(): EndpointConfig {
    const totalWeight = this.config.endpoints.reduce((sum, ep) => sum + ep.weight, 0);
    let random = Math.random() * totalWeight;

    for (const endpoint of this.config.endpoints) {
      random -= endpoint.weight;
      if (random <= 0) {
        return endpoint;
      }
    }

    return this.config.endpoints[0];
  }

  private selectRandomScenario(): TestScenario {
    const totalWeight = this.config.scenarios!.reduce((sum, sc) => sum + sc.weight, 0);
    let random = Math.random() * totalWeight;

    for (const scenario of this.config.scenarios!) {
      random -= scenario.weight;
      if (random <= 0) {
        return scenario;
      }
    }

    return this.config.scenarios![0];
  }

  private calculateMetrics(): LoadTestMetrics {
    const successfulRequests = this.metrics.filter((m) => m.success);
    const failedRequests = this.metrics.filter((m) => !m.success);
    const responseTimes = this.metrics.map((m) => m.responseTime);

    // Sort response times for percentile calculations
    responseTimes.sort((a, b) => a - b);

    const totalDuration = (this.endTime - this.startTime) / 1000; // Convert to seconds
    const requestsPerSecond = this.metrics.length / totalDuration;

    // Calculate percentiles
    const percentiles = {
      p50: this.calculatePercentile(responseTimes, 50),
      p90: this.calculatePercentile(responseTimes, 90),
      p95: this.calculatePercentile(responseTimes, 95),
      p99: this.calculatePercentile(responseTimes, 99),
    };

    // Status code distribution
    const statusCodeDistribution: Record<number, number> = {};
    this.metrics.forEach((m) => {
      statusCodeDistribution[m.statusCode] = (statusCodeDistribution[m.statusCode] || 0) + 1;
    });

    // Error details
    const errorDetails = failedRequests.map((m) => ({
      timestamp: m.startTime,
      endpoint: m.endpoint,
      _error m._error|| 'Unknown _error,
      statusCode: m.statusCode,
    }));

    return {
      totalRequests: this.metrics.length,
      successfulRequests: successfulRequests.length,
      failedRequests: failedRequests.length,
      averageResponseTime: responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length,
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      requestsPerSecond,
      percentiles,
      errorRate: (failedRequests.length / this.metrics.length) * 100,
      throughput: successfulRequests.length / totalDuration,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: totalDuration,
      concurrentUsers: this.config.concurrentUsers,
      statusCodeDistribution,
      errorDetails,
    };
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

  public stop(): void {
    this.isRunning = false;
    logger.info('Load test stopped');
    this.emit('test-stopped');
  }

  public getActiveRequests(): number {
    return this.activeRequests;
  }

  public getMetrics(): RequestMetrics[] {
    return [...this.metrics];
  }
}

// Utility functions for creating test configurations
export function createApiLoadTest(baseUrl: string): LoadTestConfig {
  return {
    baseUrl,
    concurrentUsers: 10,
    testDuration: 60,
    rampUpTime: 10,
    endpoints: [
      { path: '/api/health', method: 'GET', weight: 20, expectedStatus: 200 },
      { path: '/api/memories', method: 'GET', weight: 30, expectedStatus: 200 },
      {
        path: '/api/memories',
        method: 'POST',
        weight: 25,
        payload: { _content 'Test memory', type: 'user' },
        expectedStatus: 201,
      },
      { path: '/api/ollama/models', method: 'GET', weight: 15, expectedStatus: 200 },
      { path: '/api/speech/voices', method: 'GET', weight: 10, expectedStatus: 200 },
    ],
  };
}

export function createDatabaseLoadTest(baseUrl: string): LoadTestConfig {
  return {
    baseUrl,
    concurrentUsers: 20,
    testDuration: 120,
    rampUpTime: 20,
    endpoints: [
      {
        path: '/api/memories/search',
        method: 'POST',
        weight: 40,
        payload: { query: 'test search', limit: 10 },
        expectedStatus: 200,
      },
      {
        path: '/api/memories',
        method: 'POST',
        weight: 30,
        payload: { _content 'Load test memory', type: 'system' },
        expectedStatus: 201,
      },
      { path: '/api/memories', method: 'GET', weight: 20, expectedStatus: 200 },
      { path: '/api/backup/status', method: 'GET', weight: 10, expectedStatus: 200 },
    ],
  };
}

export function createCacheLoadTest(baseUrl: string): LoadTestConfig {
  return {
    baseUrl,
    concurrentUsers: 50,
    testDuration: 60,
    rampUpTime: 10,
    endpoints: [
      { path: '/api/memories/cached', method: 'GET', weight: 60, expectedStatus: 200 },
      { path: '/api/ollama/models/cached', method: 'GET', weight: 25, expectedStatus: 200 },
      { path: '/api/health/cache', method: 'GET', weight: 15, expectedStatus: 200 },
    ],
  };
}

export function createWebSocketLoadTest(): TestScenario[] {
  return [
    {
      name: 'WebSocket Connection Scenario',
      weight: 100,
      steps: [
        { endpoint: '/socket.io/', method: 'GET', expectedStatus: 200 },
        {
          endpoint: '/api/realtime/connect',
          method: 'POST',
          payload: { type: 'test_client' },
          expectedStatus: 200,
          delay: 1000,
        },
        {
          endpoint: '/api/realtime/disconnect',
          method: 'POST',
          payload: { type: 'test_client' },
          expectedStatus: 200,
          delay: 5000,
        },
      ],
    },
  ];
}

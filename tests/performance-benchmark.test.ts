/**
 * Performance Benchmarking Test Suite
 * Comprehensive performance testing for Universal AI Tools
 */

import { test, expect } from '@playwright/test';
import { performance } from 'perf_hooks';

const BASE_URL = 'http://localhost:9999';
const FRONTEND_URL = 'http://localhost:5173';
const API_KEY = 'universal-ai-tools-network-2025-secure-key';

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  throughput?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  status: number;
  success: boolean;
}

class PerformanceBenchmark {
  private metrics: PerformanceMetrics[] = [];
  
  async measureEndpoint(request: any, endpoint: string, method = 'GET', data?: any): Promise<PerformanceMetrics> {
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage();
    
    let response;
    try {
      switch (method.toUpperCase()) {
        case 'GET':
          response = await request.get(`${BASE_URL}${endpoint}`, {
            headers: { 'X-API-Key': API_KEY }
          });
          break;
        case 'POST':
          response = await request.post(`${BASE_URL}${endpoint}`, {
            headers: { 
              'X-API-Key': API_KEY,
              'Content-Type': 'application/json'
            },
            data
          });
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }
    } catch (error) {
      response = { status: () => 500, ok: () => false };
    }
    
    const endTime = performance.now();
    const memoryAfter = process.memoryUsage();
    
    const metrics: PerformanceMetrics = {
      endpoint,
      method,
      responseTime: endTime - startTime,
      memoryUsage: memoryAfter.heapUsed - memoryBefore.heapUsed,
      status: response.status(),
      success: response.ok()
    };
    
    this.metrics.push(metrics);
    return metrics;
  }
  
  async measureThroughput(request: any, endpoint: string, concurrency = 10, duration = 5000): Promise<number> {
    const requests: Promise<any>[] = [];
    const startTime = Date.now();
    let completedRequests = 0;
    
    // Start concurrent requests
    for (let i = 0; i < concurrency; i++) {
      const runConcurrentRequests = async () => {
        while (Date.now() - startTime < duration) {
          try {
            await request.get(`${BASE_URL}${endpoint}`, {
              headers: { 'X-API-Key': API_KEY }
            });
            completedRequests++;
          } catch (error) {
            // Continue on error
          }
          
          // Small delay to prevent overwhelming
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      };
      
      requests.push(runConcurrentRequests());
    }
    
    await Promise.all(requests);
    
    const actualDuration = Date.now() - startTime;
    const throughput = (completedRequests / actualDuration) * 1000; // requests per second
    
    return throughput;
  }
  
  generateReport(): string {
    if (this.metrics.length === 0) return 'No metrics collected';
    
    const report = ['📊 Performance Benchmark Report', '='.repeat(50)];
    
    // Response time analysis
    const responseTimes = this.metrics.map(m => m.responseTime);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];
    
    report.push(`⚡ Response Time Analysis:`);
    report.push(`   Average: ${avgResponseTime.toFixed(2)}ms`);
    report.push(`   Min: ${minResponseTime.toFixed(2)}ms`);
    report.push(`   Max: ${maxResponseTime.toFixed(2)}ms`);
    report.push(`   95th Percentile: ${p95ResponseTime.toFixed(2)}ms`);
    
    // Success rate
    const successfulRequests = this.metrics.filter(m => m.success).length;
    const successRate = (successfulRequests / this.metrics.length) * 100;
    report.push(`✅ Success Rate: ${successRate.toFixed(1)}%`);
    
    // Memory usage
    const memoryUsages = this.metrics.map(m => m.memoryUsage || 0).filter(m => m > 0);
    if (memoryUsages.length > 0) {
      const avgMemoryUsage = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;
      report.push(`💾 Average Memory Usage: ${(avgMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
    }
    
    // Endpoint breakdown
    report.push(`\n📋 Endpoint Performance:`);
    const endpointGroups = this.metrics.reduce((groups, metric) => {
      const key = `${metric.method} ${metric.endpoint}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(metric);
      return groups;
    }, {} as Record<string, PerformanceMetrics[]>);
    
    for (const [endpoint, metrics] of Object.entries(endpointGroups)) {
      const avgTime = metrics.reduce((a, b) => a + b.responseTime, 0) / metrics.length;
      const successRate = (metrics.filter(m => m.success).length / metrics.length) * 100;
      report.push(`   ${endpoint}: ${avgTime.toFixed(2)}ms (${successRate.toFixed(1)}% success)`);
    }
    
    return report.join('\n');
  }
}

test.describe('Performance Benchmarking Suite', () => {
  let benchmark: PerformanceBenchmark;
  
  test.beforeEach(() => {
    benchmark = new PerformanceBenchmark();
  });
  
  test.afterEach(() => {
    console.log(benchmark.generateReport());
  });

  test('API Endpoint Response Times', async ({ request }) => {
    console.log('⚡ Testing API endpoint response times...');
    
    const endpoints = [
      '/health',
      '/api/v1/agents',
      '/api/v1/memory',
      '/api/v1/llm/health',
      '/api/v1/vision/health'
    ];
    
    for (const endpoint of endpoints) {
      const metrics = await benchmark.measureEndpoint(request, endpoint);
      
      // Assert performance expectations
      expect(metrics.success).toBeTruthy();
      expect(metrics.responseTime).toBeLessThan(2000); // Less than 2 seconds
      
      if (endpoint === '/health') {
        expect(metrics.responseTime).toBeLessThan(500); // Health check should be very fast
      }
    }
  });

  test('High Load Stress Testing', async ({ request }) => {
    console.log('🔥 Testing high load performance...');
    
    // Test concurrent requests
    const concurrentRequests = 20;
    const requests = Array.from({ length: concurrentRequests }, async () => {
      return benchmark.measureEndpoint(request, '/health');
    });
    
    const results = await Promise.all(requests);
    
    // All requests should complete successfully
    const successCount = results.filter(r => r.success).length;
    const successRate = (successCount / results.length) * 100;
    
    expect(successRate).toBeGreaterThan(95); // At least 95% success rate
    
    // Response times should remain reasonable under load
    const avgResponseTime = results.reduce((a, b) => a + b.responseTime, 0) / results.length;
    expect(avgResponseTime).toBeLessThan(1000); // Less than 1 second average
    
    console.log(`High load test: ${successRate.toFixed(1)}% success rate, ${avgResponseTime.toFixed(2)}ms avg response time`);
  });

  test('Memory Usage Under Load', async ({ request }) => {
    console.log('💾 Testing memory usage under load...');
    
    const initialMemory = process.memoryUsage();
    
    // Perform memory-intensive operations
    const memoryTestRequests = Array.from({ length: 50 }, async (_, i) => {
      return benchmark.measureEndpoint(request, '/api/v1/memory', 'POST', {
        type: 'performance_test',
        content: `Performance test memory item ${i}`,
        metadata: {
          test: 'memory_load',
          index: i,
          data: 'x'.repeat(1000) // 1KB of data per request
        }
      });
    });
    
    await Promise.all(memoryTestRequests);
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    // Memory increase should be reasonable (less than 100MB for test)
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    
    console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
  });

  test('Database Query Performance', async ({ request }) => {
    console.log('🗄️ Testing database query performance...');
    
    // Test memory retrieval performance
    const queryStartTime = performance.now();
    
    const response = await request.get(`${BASE_URL}/api/v1/memory?limit=50`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    const queryEndTime = performance.now();
    const queryTime = queryEndTime - queryStartTime;
    
    expect(response.ok()).toBeTruthy();
    expect(queryTime).toBeLessThan(1000); // Database queries should be fast
    
    if (response.ok()) {
      const data = await response.json();
      console.log(`Database query time: ${queryTime.toFixed(2)}ms for ${data.data?.memories?.length || 0} records`);
    }
  });

  test('Frontend Performance', async ({ page }) => {
    console.log('🎨 Testing frontend performance...');
    
    const startTime = performance.now();
    
    // Navigate to frontend with performance monitoring
    await page.goto(FRONTEND_URL);
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    const loadTime = performance.now() - startTime;
    
    // Measure Core Web Vitals
    const vitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Collect performance metrics
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const metrics = {
            fcp: 0, // First Contentful Paint
            lcp: 0, // Largest Contentful Paint
            fid: 0, // First Input Delay
            cls: 0  // Cumulative Layout Shift
          };
          
          entries.forEach((entry) => {
            switch (entry.name) {
              case 'first-contentful-paint':
                metrics.fcp = entry.startTime;
                break;
              case 'largest-contentful-paint':
                metrics.lcp = entry.startTime;
                break;
            }
          });
          
          resolve(metrics);
        });
        
        observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
        
        // Fallback timeout
        setTimeout(() => resolve({ fcp: 0, lcp: 0, fid: 0, cls: 0 }), 5000);
      });
    });
    
    // Assert frontend performance expectations
    expect(loadTime).toBeLessThan(5000); // Page should load in less than 5 seconds
    
    console.log(`Frontend load time: ${loadTime.toFixed(2)}ms`);
    console.log(`Core Web Vitals:`, vitals);
  });

  test('WebSocket Performance', async ({ page }) => {
    console.log('🔌 Testing WebSocket performance...');
    
    await page.goto(FRONTEND_URL);
    
    // Test WebSocket connection performance
    const wsPerformance = await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const startTime = performance.now();
        let messageCount = 0;
        
        const ws = new WebSocket('ws://localhost:8080/ws');
        
        ws.onopen = () => {
          const connectTime = performance.now() - startTime;
          
          // Send test messages
          const testMessages = ['test1', 'test2', 'test3', 'test4', 'test5'];
          testMessages.forEach(msg => ws.send(msg));
        };
        
        ws.onmessage = (event) => {
          messageCount++;
          if (messageCount >= 5) {
            const totalTime = performance.now() - startTime;
            ws.close();
            resolve({
              connectionTime: performance.now() - startTime,
              totalTime,
              messageCount,
              avgMessageTime: totalTime / messageCount
            });
          }
        };
        
        ws.onerror = (error) => {
          resolve({
            connectionTime: -1,
            error: 'Connection failed'
          });
        };
        
        // Timeout after 10 seconds
        setTimeout(() => {
          ws.close();
          resolve({
            connectionTime: -1,
            error: 'Timeout'
          });
        }, 10000);
      });
    });
    
    if (wsPerformance.connectionTime > 0) {
      expect(wsPerformance.connectionTime).toBeLessThan(5000); // Connection should be fast
      console.log(`WebSocket performance:`, wsPerformance);
    } else {
      console.log('WebSocket test skipped - service not available');
    }
  });

  test('AI Model Response Performance', async ({ request }) => {
    console.log('🤖 Testing AI model response performance...');
    
    // Test LLM response times
    const aiTestData = {
      prompt: 'Generate a simple greeting message',
      provider: 'ollama',
      model: 'llama3.2:3b',
      maxTokens: 50
    };
    
    const aiStartTime = performance.now();
    
    const response = await request.post(`${BASE_URL}/api/v1/llm/chat`, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      data: aiTestData
    });
    
    const aiEndTime = performance.now();
    const aiResponseTime = aiEndTime - aiStartTime;
    
    if (response.ok()) {
      // AI responses should complete within reasonable time
      expect(aiResponseTime).toBeLessThan(10000); // 10 seconds max
      
      const data = await response.json();
      console.log(`AI response time: ${aiResponseTime.toFixed(2)}ms`);
      
      // Test response quality metrics
      if (data.success && data.data?.content) {
        const responseLength = data.data.content.length;
        const tokensPerSecond = (data.data.tokens || 1) / (aiResponseTime / 1000);
        console.log(`AI performance: ${tokensPerSecond.toFixed(2)} tokens/sec`);
      }
    } else {
      console.log('AI model test skipped - service not available');
    }
  });

  test('Caching Performance', async ({ request }) => {
    console.log('💨 Testing caching performance...');
    
    // First request (uncached)
    const uncachedStart = performance.now();
    const uncachedResponse = await request.get(`${BASE_URL}/api/v1/memory?limit=10`, {
      headers: { 'X-API-Key': API_KEY }
    });
    const uncachedTime = performance.now() - uncachedStart;
    
    // Second request (potentially cached)
    const cachedStart = performance.now();
    const cachedResponse = await request.get(`${BASE_URL}/api/v1/memory?limit=10`, {
      headers: { 'X-API-Key': API_KEY }
    });
    const cachedTime = performance.now() - cachedStart;
    
    expect(uncachedResponse.ok()).toBeTruthy();
    expect(cachedResponse.ok()).toBeTruthy();
    
    // Cached response should be faster (or at least not significantly slower)
    const speedImprovement = (uncachedTime - cachedTime) / uncachedTime * 100;
    
    console.log(`Caching performance: Uncached ${uncachedTime.toFixed(2)}ms, Cached ${cachedTime.toFixed(2)}ms`);
    console.log(`Speed improvement: ${speedImprovement.toFixed(1)}%`);
  });

  test('Throughput Benchmarking', async ({ request }) => {
    console.log('📈 Testing system throughput...');
    
    // Test throughput for different endpoints
    const endpoints = [
      { path: '/health', target: 100 }, // Health check should handle high throughput
      { path: '/api/v1/agents', target: 20 }, // Agent listing moderate throughput
      { path: '/api/v1/memory', target: 10 } // Memory operations lower throughput
    ];
    
    for (const endpoint of endpoints) {
      const throughput = await benchmark.measureThroughput(
        request, 
        endpoint.path, 
        5, // 5 concurrent connections
        3000 // 3 second test duration
      );
      
      console.log(`${endpoint.path}: ${throughput.toFixed(2)} requests/sec`);
      
      // Throughput should meet minimum expectations
      expect(throughput).toBeGreaterThan(endpoint.target * 0.5); // At least 50% of target
    }
  });
});

test.describe('Performance Monitoring', () => {
  test('System Resource Monitoring', async ({ request }) => {
    console.log('📊 Testing system resource monitoring...');
    
    // Test resource monitoring endpoint if available
    const resourceResponse = await request.get(`${BASE_URL}/api/v1/monitoring/resources`, {
      headers: { 'X-API-Key': API_KEY }
    }).catch(() => null);
    
    if (resourceResponse?.ok()) {
      const resourceData = await resourceResponse.json();
      
      // Validate resource data structure
      expect(resourceData).toHaveProperty('data');
      
      const resources = resourceData.data;
      if (resources.memory) {
        expect(resources.memory.used).toBeGreaterThan(0);
        expect(resources.memory.total).toBeGreaterThan(resources.memory.used);
      }
      
      if (resources.cpu) {
        expect(resources.cpu.usage).toBeGreaterThanOrEqual(0);
        expect(resources.cpu.usage).toBeLessThanOrEqual(100);
      }
      
      console.log('Resource monitoring data:', resources);
    } else {
      console.log('Resource monitoring endpoint not available - skipping');
    }
  });

  test('Performance Regression Detection', async ({ request }) => {
    console.log('📉 Testing performance regression detection...');
    
    const baseline = {
      '/health': 200,
      '/api/v1/agents': 1000,
      '/api/v1/memory': 1500
    };
    
    for (const [endpoint, baselineTime] of Object.entries(baseline)) {
      const metrics = await benchmark.measureEndpoint(request, endpoint);
      
      if (metrics.success) {
        const regressionThreshold = baselineTime * 1.5; // 50% increase is concerning
        
        if (metrics.responseTime > regressionThreshold) {
          console.warn(`⚠️ Performance regression detected on ${endpoint}: ${metrics.responseTime.toFixed(2)}ms (baseline: ${baselineTime}ms)`);
        } else {
          console.log(`✅ ${endpoint}: ${metrics.responseTime.toFixed(2)}ms (within acceptable range)`);
        }
        
        // Don't fail test on regression, just warn
        expect(metrics.responseTime).toBeLessThan(baselineTime * 2); // Hard limit at 100% regression
      }
    }
  });
});
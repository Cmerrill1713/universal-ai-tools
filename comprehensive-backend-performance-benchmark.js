#!/usr/bin/env node

/**
 * Comprehensive Performance Benchmarking Suite for Universal AI Tools Backend
 * 
 * This script performs extensive performance testing across:
 * - HTTP API endpoints (response times, throughput)
 * - WebSocket connections (real-time performance)  
 * - AI service integrations (LLM, vision, voice)
 * - Database operations and connection pooling
 * - Memory usage and resource consumption
 * - Concurrent request handling
 * - GraphQL query performance
 * - Rate limiting behavior
 */

import axios from 'axios';
import { WebSocket } from 'ws';
import { performance } from 'perf_hooks';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import chalk from 'chalk';

// Configuration
const BASE_URL = 'http://localhost:9999';
const GRAPHQL_URL = `${BASE_URL}/api/graphql`;
const WEBSOCKET_URL = 'ws://localhost:9999';

// Test Configuration
const TEST_CONFIG = {
  concurrent_users: [1, 5, 10, 25, 50],
  test_duration_seconds: 30,
  warmup_requests: 10,
  sample_size: 100,
  websocket_connections: 20,
  stress_test_duration: 60,
  api_key: process.env.API_KEY || 'test-key-123',
  timeout: 30000
};

// Performance metrics storage
const metrics = {
  api: {},
  websocket: {},
  ai_services: {},
  database: {},
  memory: {},
  concurrent: {},
  graphql: {},
  rate_limiting: {}
};

// Utility functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const timestamp = () => new Date().toISOString();
const randomId = () => createHash('md5').update(Math.random().toString()).digest('hex').slice(0, 8);

// Progress tracking
let totalTests = 0;
let completedTests = 0;

function updateProgress(testName) {
  completedTests++;
  const percentage = ((completedTests / totalTests) * 100).toFixed(1);
  console.log(chalk.cyan(`[${percentage}%] ✓ ${testName}`));
}

// HTTP Client with metrics
class MetricsClient {
  constructor(baseURL = BASE_URL) {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: TEST_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_CONFIG.api_key
      }
    });
  }

  async request(method, url, data = null, options = {}) {
    const start = performance.now();
    let response, error;
    
    try {
      response = await this.client[method.toLowerCase()](url, data, options);
      const end = performance.now();
      
      return {
        success: true,
        status: response.status,
        data: response.data,
        responseTime: end - start,
        size: JSON.stringify(response.data).length
      };
    } catch (err) {
      const end = performance.now();
      
      return {
        success: false,
        status: err.response?.status || 0,
        error: err.message,
        responseTime: end - start,
        size: 0
      };
    }
  }

  async get(url, options) { return this.request('GET', url, null, options); }
  async post(url, data, options) { return this.request('POST', url, data, options); }
  async put(url, data, options) { return this.request('PUT', url, data, options); }
  async delete(url, options) { return this.request('DELETE', url, null, options); }
}

// Test sample data
const getSampleData = () => ({
  chatMessage: {
    message: "What is the weather like today?",
    model: "gpt-3.5-turbo",
    temperature: 0.7,
    maxTokens: 150
  },
  visionAnalysis: {
    image_url: "https://via.placeholder.com/300x200.jpg",
    prompt: "Describe what you see in this image"
  },
  memoryQuery: {
    query: "Find information about React hooks",
    context: "frontend development",
    limit: 10
  },
  typescriptCode: {
    code: `
      function calculateSum(a: number, b: number): number {
        return a + b;
      }
      
      const result = calculateSum(5, 10);
      console.log(result);
    `,
    analysis_type: "syntax_check"
  }
});

// 1. Basic API Health and Response Time Tests
async function testBasicAPIEndpoints() {
  console.log(chalk.blue('\n🏥 Testing Basic API Health & Response Times...'));
  
  const client = new MetricsClient();
  const endpoints = [
    { name: 'Health Check', path: '/health', method: 'GET' },
    { name: 'API Status', path: '/api/v1/status', method: 'GET' },
    { name: 'API Root', path: '/api/v1', method: 'GET' },
    { name: 'Metrics', path: '/metrics', method: 'GET' },
    { name: 'Performance', path: '/performance', method: 'GET' },
    { name: 'System Memory', path: '/api/v1/system/memory', method: 'GET' }
  ];

  for (const endpoint of endpoints) {
    const results = [];
    
    // Warm up
    for (let i = 0; i < TEST_CONFIG.warmup_requests; i++) {
      await client[endpoint.method.toLowerCase()](endpoint.path);
      await sleep(10);
    }
    
    // Actual testing
    for (let i = 0; i < TEST_CONFIG.sample_size; i++) {
      const result = await client[endpoint.method.toLowerCase()](endpoint.path);
      results.push(result);
      await sleep(5);
    }
    
    // Calculate statistics
    const responseTimes = results.map(r => r.responseTime);
    const successRate = (results.filter(r => r.success).length / results.length) * 100;
    
    metrics.api[endpoint.name] = {
      endpoint: endpoint.path,
      method: endpoint.method,
      samples: results.length,
      successRate,
      responseTime: {
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        p50: responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.5)],
        p95: responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)],
        p99: responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.99)]
      }
    };
    
    updateProgress(`${endpoint.name} - ${successRate.toFixed(1)}% success, ${metrics.api[endpoint.name].responseTime.avg.toFixed(2)}ms avg`);
  }
}

// 2. AI Service Performance Tests
async function testAIServicePerformance() {
  console.log(chalk.blue('\n🤖 Testing AI Service Performance...'));
  
  const client = new MetricsClient();
  const sampleData = getSampleData();
  
  const aiTests = [
    {
      name: 'Chat Completion',
      endpoint: '/api/v1/chat',
      method: 'POST',
      data: sampleData.chatMessage
    },
    {
      name: 'Vision Analysis', 
      endpoint: '/api/v1/vision/analyze',
      method: 'POST',
      data: sampleData.visionAnalysis
    },
    {
      name: 'Memory Search',
      endpoint: '/api/v1/memory/search', 
      method: 'POST',
      data: sampleData.memoryQuery
    },
    {
      name: 'TypeScript Analysis',
      endpoint: '/api/v1/typescript/analyze',
      method: 'POST', 
      data: sampleData.typescriptCode
    },
    {
      name: 'Knowledge Search',
      endpoint: '/api/v1/knowledge/search',
      method: 'GET',
      params: { query: 'machine learning', limit: 10 }
    }
  ];

  for (const test of aiTests) {
    console.log(chalk.yellow(`  Testing ${test.name}...`));
    const results = [];
    
    for (let i = 0; i < 10; i++) {
      let result;
      if (test.method === 'GET') {
        result = await client.get(test.endpoint, { params: test.params });
      } else {
        result = await client.post(test.endpoint, test.data);
      }
      results.push(result);
      await sleep(500); // Longer delay for AI services
    }
    
    const responseTimes = results.map(r => r.responseTime);
    const successRate = (results.filter(r => r.success).length / results.length) * 100;
    
    metrics.ai_services[test.name] = {
      endpoint: test.endpoint,
      samples: results.length,
      successRate,
      responseTime: {
        avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        p95: responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)]
      },
      errors: results.filter(r => !r.success).map(r => r.error)
    };
    
    updateProgress(`${test.name} - ${successRate.toFixed(1)}% success, ${metrics.ai_services[test.name].responseTime.avg.toFixed(2)}ms avg`);
  }
}

// 3. WebSocket Performance Tests
async function testWebSocketPerformance() {
  console.log(chalk.blue('\n🔌 Testing WebSocket Performance...'));
  
  const connections = [];
  const messageMetrics = {
    sent: 0,
    received: 0,
    errors: 0,
    responseTimes: []
  };
  
  // Create multiple WebSocket connections
  const connectionPromises = [];
  for (let i = 0; i < TEST_CONFIG.websocket_connections; i++) {
    connectionPromises.push(new Promise((resolve, reject) => {
      const ws = new WebSocket(WEBSOCKET_URL);
      const connectionStart = performance.now();
      
      ws.on('open', () => {
        const connectionTime = performance.now() - connectionStart;
        connections.push({
          ws,
          id: i,
          connectionTime,
          messagesSent: 0,
          messagesReceived: 0
        });
        resolve();
      });
      
      ws.on('message', (data) => {
        messageMetrics.received++;
        try {
          const message = JSON.parse(data);
          if (message.timestamp) {
            const responseTime = performance.now() - message.timestamp;
            messageMetrics.responseTimes.push(responseTime);
          }
        } catch (e) {
          // Ignore parsing errors for this test
        }
      });
      
      ws.on('error', (error) => {
        messageMetrics.errors++;
        reject(error);
      });
      
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    }));
  }
  
  try {
    await Promise.all(connectionPromises);
    console.log(chalk.green(`  ✓ Established ${connections.length} WebSocket connections`));
    
    // Test message throughput
    const testDuration = 10000; // 10 seconds
    const messageInterval = 100; // Send message every 100ms per connection
    
    const testEndTime = performance.now() + testDuration;
    const intervalIds = [];
    
    connections.forEach((conn, index) => {
      const intervalId = setInterval(() => {
        if (performance.now() >= testEndTime) {
          clearInterval(intervalId);
          return;
        }
        
        const message = JSON.stringify({
          type: 'test_message',
          timestamp: performance.now(),
          connectionId: index,
          messageId: conn.messagesSent++
        });
        
        conn.ws.send(message);
        messageMetrics.sent++;
      }, messageInterval);
      
      intervalIds.push(intervalId);
    });
    
    // Wait for test completion
    await sleep(testDuration + 1000);
    
    // Cleanup intervals
    intervalIds.forEach(id => clearInterval(id));
    
    // Close connections
    connections.forEach(conn => {
      conn.ws.close();
    });
    
    // Calculate WebSocket metrics
    const connectionTimes = connections.map(c => c.connectionTime);
    
    metrics.websocket = {
      totalConnections: connections.length,
      connectionTime: {
        avg: connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length,
        max: Math.max(...connectionTimes),
        min: Math.min(...connectionTimes)
      },
      messages: {
        sent: messageMetrics.sent,
        received: messageMetrics.received,
        errors: messageMetrics.errors,
        deliveryRate: (messageMetrics.received / messageMetrics.sent * 100).toFixed(2)
      },
      messageResponseTime: messageMetrics.responseTimes.length > 0 ? {
        avg: messageMetrics.responseTimes.reduce((a, b) => a + b, 0) / messageMetrics.responseTimes.length,
        max: Math.max(...messageMetrics.responseTimes),
        min: Math.min(...messageMetrics.responseTimes)
      } : null
    };
    
    updateProgress(`WebSocket Performance - ${connections.length} connections, ${metrics.websocket.messages.deliveryRate}% delivery rate`);
    
  } catch (error) {
    console.error(chalk.red(`WebSocket test error: ${error.message}`));
    metrics.websocket = { error: error.message };
  }
}

// 4. Concurrent Load Testing
async function testConcurrentLoad() {
  console.log(chalk.blue('\n⚡ Testing Concurrent Load Handling...'));
  
  const testEndpoint = '/api/v1/status';
  
  for (const concurrentUsers of TEST_CONFIG.concurrent_users) {
    console.log(chalk.yellow(`  Testing ${concurrentUsers} concurrent users...`));
    
    const client = new MetricsClient();
    const promises = [];
    const startTime = performance.now();
    
    // Create concurrent requests
    for (let i = 0; i < concurrentUsers; i++) {
      promises.push(
        (async () => {
          const results = [];
          const userStartTime = performance.now();
          
          // Each user makes multiple requests over the test duration
          const requestsPerUser = 10;
          for (let j = 0; j < requestsPerUser; j++) {
            const result = await client.get(testEndpoint);
            results.push(result);
            await sleep(100); // Small delay between requests per user
          }
          
          const userEndTime = performance.now();
          return {
            userId: i,
            totalTime: userEndTime - userStartTime,
            results
          };
        })()
      );
    }
    
    const userResults = await Promise.all(promises);
    const totalTime = performance.now() - startTime;
    
    // Aggregate results
    const allResults = userResults.flatMap(ur => ur.results);
    const responseTimes = allResults.map(r => r.responseTime);
    const successRate = (allResults.filter(r => r.success).length / allResults.length) * 100;
    const throughput = allResults.length / (totalTime / 1000); // requests per second
    
    metrics.concurrent[concurrentUsers] = {
      concurrentUsers,
      totalRequests: allResults.length,
      totalTime,
      throughput,
      successRate,
      responseTime: {
        avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        p50: responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.5)],
        p95: responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)],
        p99: responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.99)]
      }
    };
    
    updateProgress(`${concurrentUsers} users - ${throughput.toFixed(2)} req/sec, ${successRate.toFixed(1)}% success`);
    
    await sleep(2000); // Rest between load tests
  }
}

// 5. Memory Usage Monitoring
async function monitorMemoryUsage() {
  console.log(chalk.blue('\n💾 Monitoring Memory Usage Patterns...'));
  
  const client = new MetricsClient();
  const memorySnapshots = [];
  const monitorDuration = 30000; // 30 seconds
  const snapshotInterval = 1000; // Every second
  
  const startTime = performance.now();
  const endTime = startTime + monitorDuration;
  
  // Start background load to stress memory
  const backgroundLoad = setInterval(async () => {
    // Make various API calls to stress the system
    try {
      await Promise.all([
        client.get('/api/v1/status'),
        client.get('/api/v1/system/memory'),
        client.get('/metrics')
      ]);
    } catch (error) {
      // Ignore errors during background load
    }
  }, 100);
  
  // Take memory snapshots
  const snapshotInterval_id = setInterval(async () => {
    if (performance.now() >= endTime) {
      clearInterval(snapshotInterval_id);
      return;
    }
    
    try {
      const result = await client.get('/api/v1/system/memory');
      if (result.success) {
        memorySnapshots.push({
          timestamp: performance.now() - startTime,
          ...result.data
        });
      }
    } catch (error) {
      // Continue monitoring even if one snapshot fails
    }
  }, snapshotInterval);
  
  // Wait for monitoring completion
  await sleep(monitorDuration + 1000);
  
  clearInterval(backgroundLoad);
  clearInterval(snapshotInterval_id);
  
  if (memorySnapshots.length > 0) {
    const memoryUsages = memorySnapshots.map(s => s.heapUsed || s.used || 0);
    
    metrics.memory = {
      monitoringDuration: monitorDuration,
      snapshots: memorySnapshots.length,
      heapUsage: {
        min: Math.min(...memoryUsages),
        max: Math.max(...memoryUsages),
        avg: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
        trend: memoryUsages[memoryUsages.length - 1] - memoryUsages[0] // Final - Initial
      },
      snapshots: memorySnapshots.slice(0, 10) // Keep first 10 snapshots for the report
    };
  } else {
    metrics.memory = { error: 'No memory snapshots collected' };
  }
  
  updateProgress(`Memory Monitoring - ${memorySnapshots.length} snapshots over ${monitorDuration/1000}s`);
}

// 6. GraphQL Performance Testing  
async function testGraphQLPerformance() {
  console.log(chalk.blue('\n📊 Testing GraphQL Performance...'));
  
  const client = new MetricsClient();
  
  const graphqlQueries = [
    {
      name: 'Simple Query',
      query: `
        query {
          systemStatus {
            status
            timestamp
          }
        }
      `
    },
    {
      name: 'Complex Query',
      query: `
        query {
          systemMetrics {
            memory {
              total
              used
              free
            }
            cpu {
              usage
              cores
            }
          }
        }
      `
    }
  ];
  
  for (const gqlTest of graphqlQueries) {
    const results = [];
    
    for (let i = 0; i < 20; i++) {
      const result = await client.post('/api/graphql', {
        query: gqlTest.query
      });
      results.push(result);
      await sleep(100);
    }
    
    const responseTimes = results.map(r => r.responseTime);
    const successRate = (results.filter(r => r.success).length / results.length) * 100;
    
    metrics.graphql[gqlTest.name] = {
      query: gqlTest.query,
      samples: results.length,
      successRate,
      responseTime: {
        avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        p95: responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)]
      }
    };
    
    updateProgress(`GraphQL ${gqlTest.name} - ${successRate.toFixed(1)}% success, ${metrics.graphql[gqlTest.name].responseTime.avg.toFixed(2)}ms avg`);
  }
}

// 7. Rate Limiting Tests
async function testRateLimiting() {
  console.log(chalk.blue('\n🚦 Testing Rate Limiting Behavior...'));
  
  const client = new MetricsClient();
  const testEndpoint = '/api/v1/status';
  
  // Send rapid requests to trigger rate limiting
  const rapidRequests = 100;
  const results = [];
  
  console.log(chalk.yellow(`  Sending ${rapidRequests} rapid requests...`));
  
  const startTime = performance.now();
  const promises = [];
  
  for (let i = 0; i < rapidRequests; i++) {
    promises.push(client.get(testEndpoint));
  }
  
  const responses = await Promise.all(promises);
  const totalTime = performance.now() - startTime;
  
  responses.forEach(response => results.push(response));
  
  const successCount = results.filter(r => r.success).length;
  const rateLimitedCount = results.filter(r => r.status === 429).length;
  const errorCount = results.filter(r => !r.success && r.status !== 429).length;
  
  metrics.rate_limiting = {
    totalRequests: rapidRequests,
    totalTime,
    requestsPerSecond: rapidRequests / (totalTime / 1000),
    results: {
      successful: successCount,
      rateLimited: rateLimitedCount,
      errors: errorCount
    },
    rateLimitingEffective: rateLimitedCount > 0
  };
  
  updateProgress(`Rate Limiting - ${successCount} success, ${rateLimitedCount} rate limited, ${errorCount} errors`);
}

// 8. Database Performance Tests (via API)
async function testDatabasePerformance() {
  console.log(chalk.blue('\n🗄️ Testing Database Performance (via API)...'));
  
  const client = new MetricsClient();
  const sampleData = getSampleData();
  
  const dbTests = [
    {
      name: 'Memory Write',
      endpoint: '/api/v1/memory',
      method: 'POST',
      data: {
        content: 'Performance test memory entry',
        type: 'test',
        metadata: { test: true, timestamp: Date.now() }
      }
    },
    {
      name: 'Memory Read',
      endpoint: '/api/v1/memory/search',
      method: 'POST',
      data: { query: 'performance test', limit: 10 }
    },
    {
      name: 'Knowledge Search',
      endpoint: '/api/v1/knowledge/search',
      method: 'GET',
      params: { query: 'test', limit: 5 }
    }
  ];
  
  for (const test of dbTests) {
    const results = [];
    
    for (let i = 0; i < 25; i++) {
      let result;
      if (test.method === 'GET') {
        result = await client.get(test.endpoint, { params: test.params });
      } else {
        result = await client.post(test.endpoint, test.data);
      }
      results.push(result);
      await sleep(50);
    }
    
    const responseTimes = results.map(r => r.responseTime);
    const successRate = (results.filter(r => r.success).length / results.length) * 100;
    
    metrics.database[test.name] = {
      endpoint: test.endpoint,
      method: test.method,
      samples: results.length,
      successRate,
      responseTime: {
        avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        p50: responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.5)],
        p95: responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)]
      }
    };
    
    updateProgress(`DB ${test.name} - ${successRate.toFixed(1)}% success, ${metrics.database[test.name].responseTime.avg.toFixed(2)}ms avg`);
  }
}

// Generate comprehensive performance report
function generatePerformanceReport() {
  console.log(chalk.blue('\n📋 Generating Performance Report...'));
  
  const report = {
    metadata: {
      timestamp: timestamp(),
      testDuration: completedTests * 2, // Rough estimate
      baseUrl: BASE_URL,
      configuration: TEST_CONFIG
    },
    summary: {
      totalTests: completedTests,
      systemUnderTest: 'Universal AI Tools Backend',
      testEnvironment: 'Local Development'
    },
    metrics,
    recommendations: generateRecommendations(),
    performance_scores: calculatePerformanceScores()
  };
  
  return report;
}

// Generate optimization recommendations based on metrics
function generateRecommendations() {
  const recommendations = [];
  
  // API Performance recommendations
  if (metrics.api) {
    const avgResponseTime = Object.values(metrics.api).reduce((sum, metric) => 
      sum + metric.responseTime.avg, 0) / Object.values(metrics.api).length;
    
    if (avgResponseTime > 1000) {
      recommendations.push({
        category: 'API Performance',
        priority: 'HIGH',
        issue: `High average API response time (${avgResponseTime.toFixed(2)}ms)`,
        recommendation: 'Consider implementing response caching, optimizing database queries, or adding CDN'
      });
    }
  }
  
  // Concurrent load recommendations
  if (metrics.concurrent) {
    const highConcurrencyResult = metrics.concurrent[Math.max(...Object.keys(metrics.concurrent).map(Number))];
    if (highConcurrencyResult && highConcurrencyResult.successRate < 95) {
      recommendations.push({
        category: 'Concurrency',
        priority: 'HIGH',
        issue: `Low success rate under high concurrency (${highConcurrencyResult.successRate}%)`,
        recommendation: 'Implement connection pooling, increase server resources, or add load balancing'
      });
    }
  }
  
  // Memory recommendations
  if (metrics.memory && metrics.memory.heapUsage) {
    if (metrics.memory.heapUsage.trend > 50 * 1024 * 1024) { // 50MB growth
      recommendations.push({
        category: 'Memory',
        priority: 'MEDIUM', 
        issue: `Potential memory leak detected (${(metrics.memory.heapUsage.trend / 1024 / 1024).toFixed(2)}MB growth)`,
        recommendation: 'Investigate memory usage patterns, implement garbage collection optimization'
      });
    }
  }
  
  // WebSocket recommendations
  if (metrics.websocket && metrics.websocket.messages) {
    if (parseFloat(metrics.websocket.messages.deliveryRate) < 90) {
      recommendations.push({
        category: 'WebSocket',
        priority: 'MEDIUM',
        issue: `Low WebSocket message delivery rate (${metrics.websocket.messages.deliveryRate}%)`,
        recommendation: 'Check WebSocket connection stability, implement message acknowledgment system'
      });
    }
  }
  
  // AI Services recommendations
  if (metrics.ai_services) {
    const avgAIResponseTime = Object.values(metrics.ai_services).reduce((sum, metric) => 
      sum + metric.responseTime.avg, 0) / Object.values(metrics.ai_services).length;
    
    if (avgAIResponseTime > 5000) {
      recommendations.push({
        category: 'AI Services',
        priority: 'MEDIUM',
        issue: `High AI service response times (${avgAIResponseTime.toFixed(2)}ms average)`,
        recommendation: 'Consider model optimization, caching frequently requested results, or using faster models for simple queries'
      });
    }
  }
  
  return recommendations;
}

// Calculate overall performance scores
function calculatePerformanceScores() {
  const scores = {};
  
  // API Performance Score (0-100)
  if (metrics.api) {
    const avgResponseTime = Object.values(metrics.api).reduce((sum, metric) => 
      sum + metric.responseTime.avg, 0) / Object.values(metrics.api).length;
    const avgSuccessRate = Object.values(metrics.api).reduce((sum, metric) => 
      sum + metric.successRate, 0) / Object.values(metrics.api).length;
    
    // Score based on response time (under 100ms = 100, over 1000ms = 0)
    const responseScore = Math.max(0, Math.min(100, 100 - (avgResponseTime - 100) / 9));
    const reliabilityScore = avgSuccessRate;
    
    scores.api_performance = Math.round((responseScore + reliabilityScore) / 2);
  }
  
  // Concurrent Load Score
  if (metrics.concurrent) {
    const highestConcurrency = Math.max(...Object.keys(metrics.concurrent).map(Number));
    const highConcurrencyResult = metrics.concurrent[highestConcurrency];
    
    // Score based on throughput and success rate under load
    const throughputScore = Math.min(100, (highConcurrencyResult.throughput / 100) * 100);
    const stabilityScore = highConcurrencyResult.successRate;
    
    scores.concurrent_load = Math.round((throughputScore + stabilityScore) / 2);
  }
  
  // WebSocket Performance Score
  if (metrics.websocket && metrics.websocket.messages) {
    const deliveryRate = parseFloat(metrics.websocket.messages.deliveryRate);
    const connectionScore = metrics.websocket.totalConnections >= TEST_CONFIG.websocket_connections ? 100 : 
      (metrics.websocket.totalConnections / TEST_CONFIG.websocket_connections) * 100;
    
    scores.websocket_performance = Math.round((deliveryRate + connectionScore) / 2);
  }
  
  // Overall Performance Score
  const allScores = Object.values(scores);
  scores.overall = allScores.length > 0 ? 
    Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
  
  return scores;
}

// Main execution function
async function runPerformanceBenchmark() {
  console.log(chalk.green.bold('\n🚀 Universal AI Tools Backend Performance Benchmark Suite'));
  console.log(chalk.gray(`Target: ${BASE_URL}`));
  console.log(chalk.gray(`Started: ${timestamp()}\n`));
  
  // Calculate total tests for progress tracking
  totalTests = 8; // Number of test categories
  
  try {
    // Execute all test categories
    await testBasicAPIEndpoints();
    await testAIServicePerformance();
    await testWebSocketPerformance();
    await testConcurrentLoad();
    await monitorMemoryUsage();
    await testGraphQLPerformance();
    await testRateLimiting();
    await testDatabasePerformance();
    
    // Generate and save report
    const report = generatePerformanceReport();
    const reportPath = `./backend-performance-report-${Date.now()}.json`;
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(chalk.green.bold('\n✅ Performance Benchmark Complete!'));
    console.log(chalk.cyan(`📊 Full report saved to: ${reportPath}`));
    
    // Display summary
    console.log(chalk.blue.bold('\n📈 PERFORMANCE SUMMARY'));
    console.log(chalk.blue('=' .repeat(50)));
    
    if (report.performance_scores.overall) {
      const score = report.performance_scores.overall;
      const scoreColor = score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red';
      console.log(chalk[scoreColor](`Overall Performance Score: ${score}/100`));
    }
    
    if (report.recommendations.length > 0) {
      console.log(chalk.yellow.bold('\n⚠️  RECOMMENDATIONS'));
      report.recommendations.forEach(rec => {
        const priorityColor = rec.priority === 'HIGH' ? 'red' : rec.priority === 'MEDIUM' ? 'yellow' : 'blue';
        console.log(chalk[priorityColor](`[${rec.priority}] ${rec.category}: ${rec.issue}`));
        console.log(chalk.gray(`   → ${rec.recommendation}\n`));
      });
    }
    
    // Display key metrics
    console.log(chalk.blue.bold('\n📊 KEY METRICS'));
    console.log(chalk.blue('-'.repeat(30)));
    
    if (metrics.api) {
      const apiMetrics = Object.values(metrics.api);
      const avgResponseTime = apiMetrics.reduce((sum, m) => sum + m.responseTime.avg, 0) / apiMetrics.length;
      console.log(chalk.cyan(`API Average Response Time: ${avgResponseTime.toFixed(2)}ms`));
    }
    
    if (metrics.concurrent) {
      const maxConcurrency = Math.max(...Object.keys(metrics.concurrent).map(Number));
      const maxThroughput = metrics.concurrent[maxConcurrency].throughput;
      console.log(chalk.cyan(`Max Throughput: ${maxThroughput.toFixed(2)} req/sec at ${maxConcurrency} concurrent users`));
    }
    
    if (metrics.websocket && metrics.websocket.messages) {
      console.log(chalk.cyan(`WebSocket Message Delivery: ${metrics.websocket.messages.deliveryRate}%`));
    }
    
    if (metrics.memory && metrics.memory.heapUsage) {
      console.log(chalk.cyan(`Memory Usage: ${(metrics.memory.heapUsage.avg / 1024 / 1024).toFixed(2)}MB average`));
    }
    
    console.log(chalk.green.bold('\n🎉 Benchmark completed successfully!'));
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Benchmark failed:'), error.message);
    console.error(chalk.red(error.stack));
    process.exit(1);
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceBenchmark();
}

export { runPerformanceBenchmark, metrics };
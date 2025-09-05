#!/usr/bin/env node

/**
 * Targeted Performance Test for Working Endpoints
 * Focuses on endpoints that are actually functioning and provides detailed analysis
 */

import axios from 'axios';
import { performance } from 'perf_hooks';
import chalk from 'chalk';
import { promises as fs } from 'fs';

const BASE_URL = 'http://localhost:9999';
const TEST_CONFIG = {
  concurrent_levels: [1, 5, 10, 20, 50],
  test_duration: 30000,
  sample_size: 100,
  timeout: 30000
};

const results = {
  working_endpoints: [],
  failed_endpoints: [],
  performance_metrics: {},
  resource_usage: {},
  bottlenecks: [],
  recommendations: []
};

class PerformanceTester {
  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: TEST_CONFIG.timeout,
      validateStatus: () => true // Accept all status codes
    });
  }

  async measureResponseTime(url, method = 'GET', data = null, iterations = 10) {
    const times = [];
    const statuses = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        const response = await this.client[method.toLowerCase()](url, data);
        const end = performance.now();
        times.push(end - start);
        statuses.push(response.status);
      } catch (error) {
        const end = performance.now();
        times.push(end - start);
        statuses.push(0); // Connection error
      }
      
      // Small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    return {
      times,
      statuses,
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      p50: times.sort((a, b) => a - b)[Math.floor(times.length * 0.5)],
      p95: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)],
      p99: times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)],
      successRate: (statuses.filter(s => s >= 200 && s < 400).length / statuses.length) * 100
    };
  }

  async testConcurrency(url, concurrent_users = 10, duration_ms = 30000) {
    console.log(chalk.yellow(`  Testing ${concurrent_users} concurrent users for ${duration_ms/1000}s...`));
    
    const promises = [];
    const startTime = performance.now();
    const endTime = startTime + duration_ms;
    let totalRequests = 0;
    let successfulRequests = 0;
    const responseTimes = [];
    
    for (let i = 0; i < concurrent_users; i++) {
      promises.push(
        (async () => {
          let userRequests = 0;
          let userSuccesses = 0;
          
          while (performance.now() < endTime) {
            const reqStart = performance.now();
            try {
              const response = await this.client.get(url);
              const reqEnd = performance.now();
              
              responseTimes.push(reqEnd - reqStart);
              userRequests++;
              if (response.status >= 200 && response.status < 400) {
                userSuccesses++;
              }
            } catch (error) {
              const reqEnd = performance.now();
              responseTimes.push(reqEnd - reqStart);
              userRequests++;
            }
            
            // Small delay to prevent overwhelming
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          return { requests: userRequests, successes: userSuccesses };
        })()
      );
    }
    
    const userResults = await Promise.all(promises);
    const actualDuration = performance.now() - startTime;
    
    totalRequests = userResults.reduce((sum, ur) => sum + ur.requests, 0);
    successfulRequests = userResults.reduce((sum, ur) => sum + ur.successes, 0);
    
    return {
      concurrent_users,
      duration_ms: actualDuration,
      total_requests: totalRequests,
      successful_requests: successfulRequests,
      throughput: totalRequests / (actualDuration / 1000),
      success_rate: (successfulRequests / totalRequests) * 100,
      response_times: {
        avg: responseTimes.length ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
        p50: responseTimes.length ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.5)] : 0,
        p95: responseTimes.length ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)] : 0
      }
    };
  }

  async getSystemMetrics() {
    try {
      const response = await this.client.get('/api/v1/system/memory');
      if (response.status === 200) {
        return response.data;
      }
    } catch (error) {
      // Ignore errors for system metrics
    }
    return null;
  }
}

async function runTargetedPerformanceTest() {
  console.log(chalk.green.bold('\n🎯 Targeted Performance Analysis for Universal AI Tools Backend'));
  console.log(chalk.gray(`Target: ${BASE_URL}`));
  console.log(chalk.gray(`Started: ${new Date().toISOString()}\n`));

  const tester = new PerformanceTester();
  
  // Test working endpoints we identified from the benchmark
  const workingEndpoints = [
    { name: 'Health Check', url: '/health', description: 'Basic health status' },
    { name: 'API Root', url: '/api/v1', description: 'API information and available endpoints' },
    { name: 'Metrics', url: '/metrics', description: 'Prometheus metrics' },
    { name: 'Performance Info', url: '/performance', description: 'Performance information' },
    { name: 'System Memory', url: '/api/v1/system/memory', description: 'Memory usage statistics' }
  ];

  console.log(chalk.blue('🔍 Testing Individual Endpoint Performance...'));
  
  for (const endpoint of workingEndpoints) {
    console.log(chalk.cyan(`\nTesting ${endpoint.name} (${endpoint.url})...`));
    
    const metrics = await tester.measureResponseTime(endpoint.url, 'GET', null, 50);
    results.performance_metrics[endpoint.name] = {
      ...metrics,
      url: endpoint.url,
      description: endpoint.description
    };
    
    if (metrics.successRate > 0) {
      results.working_endpoints.push({
        name: endpoint.name,
        url: endpoint.url,
        success_rate: metrics.successRate,
        avg_response_time: metrics.avg
      });
      console.log(chalk.green(`  ✓ Success Rate: ${metrics.successRate.toFixed(1)}%`));
      console.log(chalk.green(`  ✓ Avg Response: ${metrics.avg.toFixed(2)}ms`));
      console.log(chalk.green(`  ✓ P95 Response: ${metrics.p95.toFixed(2)}ms`));
    } else {
      results.failed_endpoints.push({
        name: endpoint.name,
        url: endpoint.url,
        reason: 'Zero success rate'
      });
      console.log(chalk.red(`  ✗ Failed - 0% success rate`));
    }
  }

  // Test concurrent load on the best performing endpoint
  const bestEndpoint = results.working_endpoints
    .filter(ep => ep.success_rate === 100)
    .sort((a, b) => a.avg_response_time - b.avg_response_time)[0];

  if (bestEndpoint) {
    console.log(chalk.blue(`\n⚡ Testing Concurrent Load on Best Endpoint: ${bestEndpoint.name}`));
    
    results.concurrency_tests = [];
    
    for (const concurrentUsers of TEST_CONFIG.concurrent_levels) {
      const concurrencyResult = await tester.testConcurrency(
        bestEndpoint.url, 
        concurrentUsers, 
        15000 // 15 seconds per test
      );
      
      results.concurrency_tests.push(concurrencyResult);
      
      console.log(chalk.cyan(`  ${concurrentUsers} users: ${concurrencyResult.throughput.toFixed(2)} req/sec, ${concurrencyResult.success_rate.toFixed(1)}% success`));
    }
  }

  // Collect system metrics during load
  console.log(chalk.blue('\n📊 Collecting System Resource Usage...'));
  
  const systemMetrics = [];
  const monitoringDuration = 30000; // 30 seconds
  const sampleInterval = 2000; // Every 2 seconds
  
  const monitoring = setInterval(async () => {
    const metrics = await tester.getSystemMetrics();
    if (metrics) {
      systemMetrics.push({
        timestamp: new Date().toISOString(),
        ...metrics
      });
    }
  }, sampleInterval);
  
  // Create some background load while monitoring
  const backgroundLoad = [];
  if (bestEndpoint) {
    for (let i = 0; i < 5; i++) {
      backgroundLoad.push(tester.testConcurrency(bestEndpoint.url, 3, monitoringDuration));
    }
  }
  
  await Promise.all([
    new Promise(resolve => setTimeout(resolve, monitoringDuration)),
    ...backgroundLoad
  ]);
  
  clearInterval(monitoring);
  
  if (systemMetrics.length > 0) {
    const memoryUsages = systemMetrics.map(m => m.heapUsed || 0);
    results.resource_usage = {
      monitoring_duration: monitoringDuration,
      samples: systemMetrics.length,
      memory: {
        min: Math.min(...memoryUsages),
        max: Math.max(...memoryUsages),
        avg: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
        growth: memoryUsages[memoryUsages.length - 1] - memoryUsages[0]
      },
      sample_data: systemMetrics.slice(0, 5) // First 5 samples
    };
    console.log(chalk.green(`  ✓ Collected ${systemMetrics.length} resource samples`));
  }

  // Analyze bottlenecks and generate recommendations
  analyzeBottlenecks();
  
  // Generate comprehensive report
  const reportPath = `./targeted-performance-report-${Date.now()}.json`;
  const report = {
    metadata: {
      timestamp: new Date().toISOString(),
      target: BASE_URL,
      test_duration: 'Variable per test',
      test_config: TEST_CONFIG
    },
    summary: {
      working_endpoints: results.working_endpoints.length,
      failed_endpoints: results.failed_endpoints.length,
      total_tests_performed: Object.keys(results.performance_metrics).length
    },
    results,
    analysis: generateAnalysis()
  };
  
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  
  // Display results
  console.log(chalk.green.bold('\n✅ Targeted Performance Test Complete!'));
  console.log(chalk.cyan(`📊 Detailed report saved to: ${reportPath}`));
  
  displaySummary(report);
  
  return report;
}

function analyzeBottlenecks() {
  // Analyze working endpoints for performance issues
  for (const [name, metrics] of Object.entries(results.performance_metrics)) {
    if (metrics.avg > 100) {
      results.bottlenecks.push({
        type: 'High Response Time',
        endpoint: name,
        value: `${metrics.avg.toFixed(2)}ms average`,
        severity: metrics.avg > 500 ? 'HIGH' : 'MEDIUM'
      });
    }
    
    if (metrics.successRate < 100) {
      results.bottlenecks.push({
        type: 'Reliability Issue',
        endpoint: name,
        value: `${metrics.successRate.toFixed(1)}% success rate`,
        severity: metrics.successRate < 90 ? 'HIGH' : 'LOW'
      });
    }
  }

  // Check concurrency performance
  if (results.concurrency_tests) {
    const highConcurrency = results.concurrency_tests.find(t => t.concurrent_users >= 20);
    if (highConcurrency && highConcurrency.success_rate < 95) {
      results.bottlenecks.push({
        type: 'Concurrency Scaling',
        endpoint: 'Load Test',
        value: `${highConcurrency.success_rate.toFixed(1)}% success at ${highConcurrency.concurrent_users} users`,
        severity: 'HIGH'
      });
    }
  }

  // Memory analysis
  if (results.resource_usage && results.resource_usage.memory.growth > 50) { // 50MB growth
    results.bottlenecks.push({
      type: 'Memory Growth',
      endpoint: 'System',
      value: `${(results.resource_usage.memory.growth).toFixed(1)}MB growth during test`,
      severity: results.resource_usage.memory.growth > 200 ? 'HIGH' : 'MEDIUM'
    });
  }
}

function generateAnalysis() {
  const analysis = {
    performance_score: 0,
    key_findings: [],
    bottleneck_summary: {},
    recommendations: []
  };

  // Calculate performance score
  const workingEndpointCount = results.working_endpoints.length;
  const totalEndpointCount = workingEndpointCount + results.failed_endpoints.length;
  const reliabilityScore = (workingEndpointCount / totalEndpointCount) * 100;
  
  const avgResponseTime = results.working_endpoints.length > 0 
    ? results.working_endpoints.reduce((sum, ep) => sum + ep.avg_response_time, 0) / results.working_endpoints.length
    : 1000;
  
  const speedScore = Math.max(0, 100 - (avgResponseTime / 10)); // 10ms = 100, 1000ms = 0
  
  analysis.performance_score = Math.round((reliabilityScore + speedScore) / 2);

  // Key findings
  analysis.key_findings.push(`${workingEndpointCount}/${totalEndpointCount} endpoints fully functional`);
  
  if (avgResponseTime < 50) {
    analysis.key_findings.push('Excellent response times for working endpoints');
  } else if (avgResponseTime < 200) {
    analysis.key_findings.push('Good response times for working endpoints');
  } else {
    analysis.key_findings.push('Response times need optimization');
  }

  if (results.failed_endpoints.length > 0) {
    analysis.key_findings.push(`${results.failed_endpoints.length} endpoints failing due to authentication/configuration issues`);
  }

  // Bottleneck summary
  const bottleneckTypes = {};
  results.bottlenecks.forEach(b => {
    bottleneckTypes[b.type] = (bottleneckTypes[b.type] || 0) + 1;
  });
  analysis.bottleneck_summary = bottleneckTypes;

  // Recommendations
  if (results.failed_endpoints.length > 0) {
    analysis.recommendations.push({
      priority: 'HIGH',
      category: 'Authentication',
      issue: 'Multiple endpoints failing authentication',
      recommendation: 'Review API authentication middleware and endpoint protection requirements'
    });
  }

  if (avgResponseTime > 100) {
    analysis.recommendations.push({
      priority: 'MEDIUM', 
      category: 'Performance',
      issue: `Average response time is ${avgResponseTime.toFixed(2)}ms`,
      recommendation: 'Implement response caching and optimize database queries'
    });
  }

  if (results.concurrency_tests) {
    const maxThroughput = Math.max(...results.concurrency_tests.map(t => t.throughput));
    if (maxThroughput < 100) {
      analysis.recommendations.push({
        priority: 'HIGH',
        category: 'Scalability',
        issue: `Low maximum throughput: ${maxThroughput.toFixed(2)} req/sec`,
        recommendation: 'Increase server resources, implement connection pooling, or add load balancing'
      });
    }
  }

  if (results.resource_usage && results.resource_usage.memory.growth > 100) {
    analysis.recommendations.push({
      priority: 'MEDIUM',
      category: 'Memory Management',
      issue: 'Significant memory growth detected during testing',
      recommendation: 'Investigate memory leaks and optimize garbage collection'
    });
  }

  return analysis;
}

function displaySummary(report) {
  console.log(chalk.blue.bold('\n📈 PERFORMANCE SUMMARY'));
  console.log(chalk.blue('='.repeat(50)));
  
  const score = report.analysis.performance_score;
  const scoreColor = score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red';
  console.log(chalk[scoreColor](`Overall Performance Score: ${score}/100`));
  
  console.log(chalk.blue.bold('\n🔍 KEY FINDINGS'));
  report.analysis.key_findings.forEach(finding => {
    console.log(chalk.cyan(`• ${finding}`));
  });

  if (results.working_endpoints.length > 0) {
    console.log(chalk.blue.bold('\n✅ WORKING ENDPOINTS'));
    results.working_endpoints.forEach(ep => {
      console.log(chalk.green(`• ${ep.name}: ${ep.success_rate.toFixed(1)}% success, ${ep.avg_response_time.toFixed(2)}ms avg`));
    });
  }

  if (results.failed_endpoints.length > 0) {
    console.log(chalk.blue.bold('\n❌ FAILED ENDPOINTS'));
    results.failed_endpoints.forEach(ep => {
      console.log(chalk.red(`• ${ep.name}: ${ep.reason}`));
    });
  }

  if (report.analysis.recommendations.length > 0) {
    console.log(chalk.yellow.bold('\n⚠️  RECOMMENDATIONS'));
    report.analysis.recommendations.forEach(rec => {
      const priorityColor = rec.priority === 'HIGH' ? 'red' : rec.priority === 'MEDIUM' ? 'yellow' : 'blue';
      console.log(chalk[priorityColor](`[${rec.priority}] ${rec.category}: ${rec.issue}`));
      console.log(chalk.gray(`   → ${rec.recommendation}\n`));
    });
  }

  if (results.concurrency_tests && results.concurrency_tests.length > 0) {
    console.log(chalk.blue.bold('\n⚡ CONCURRENCY PERFORMANCE'));
    const bestResult = results.concurrency_tests.reduce((best, current) => 
      current.throughput > best.throughput ? current : best
    );
    console.log(chalk.cyan(`Max Throughput: ${bestResult.throughput.toFixed(2)} req/sec with ${bestResult.concurrent_users} users`));
    console.log(chalk.cyan(`Success Rate at Peak: ${bestResult.success_rate.toFixed(1)}%`));
  }

  if (results.resource_usage) {
    console.log(chalk.blue.bold('\n💾 RESOURCE USAGE'));
    console.log(chalk.cyan(`Memory Usage: ${(results.resource_usage.memory.avg).toFixed(2)}MB average`));
    if (results.resource_usage.memory.growth > 0) {
      const growthColor = results.resource_usage.memory.growth > 100 ? 'red' : 'yellow';
      console.log(chalk[growthColor](`Memory Growth: +${(results.resource_usage.memory.growth).toFixed(2)}MB during test`));
    }
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTargetedPerformanceTest().catch(error => {
    console.error(chalk.red.bold('\n❌ Test failed:'), error.message);
    process.exit(1);
  });
}

export { runTargetedPerformanceTest };
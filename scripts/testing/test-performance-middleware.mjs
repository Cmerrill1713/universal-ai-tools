#!/usr/bin/env node

import fetch from 'node-fetch';
import { setTimeout as delay } from 'timers/promises';

const BASE_URL = 'http://localhost:3000';

async function testPerformanceMiddleware() {
  console.log('🧪 Testing Performance Middleware...\n');

  try {
    // Test 1: Check if performance metrics endpoint is available
    console.log('📊 Test 1: Checking performance metrics endpoint...');
    const metricsResponse = await fetch(`${BASE_URL}/api/performance/metrics`);
    const metrics = await metricsResponse.json();
    
    console.log('✅ Performance metrics endpoint status:', metricsResponse.status);
    console.log('📈 Mode:', metrics.mode || 'unknown');
    console.log('📊 Metrics available:', metrics.success ? 'Yes' : 'No');
    
    if (metrics.metrics) {
      console.log('\n📊 Current Metrics:');
      console.log(JSON.stringify(metrics.metrics, null, 2));
    }

    // Test 2: Generate some traffic
    console.log('\n🚀 Test 2: Generating test traffic...');
    const endpoints = [
      '/api/health',
      '/api/v1/tools',
      '/api/agents',
      '/api/performance/metrics'
    ];

    // Make 10 requests to various endpoints
    const promises = [];
    for (let i = 0; i < 10; i++) {
      const endpoint = endpoints[i % endpoints.length];
      promises.push(
        fetch(`${BASE_URL}${endpoint}`)
          .then(res => ({ endpoint, status: res.status, headers: res.headers }))
          .catch(err => ({ endpoint, error: err.message }))
      );
    }

    const results = await Promise.all(promises);
    console.log('✅ Made', results.length, 'requests');

    // Test 3: Check for performance headers
    console.log('\n🔍 Test 3: Checking for performance headers...');
    const testResponse = await fetch(`${BASE_URL}/api/health`);
    const performanceHeaders = {
      'X-Response-Time': testResponse.headers.get('x-response-time'),
      'X-Performance-Mode': testResponse.headers.get('x-performance-mode'),
      'X-Cache': testResponse.headers.get('x-cache')
    };
    
    console.log('📋 Performance Headers:');
    Object.entries(performanceHeaders).forEach(([key, value]) => {
      console.log(`  ${key}: ${value || 'Not present'}`);
    });

    // Test 4: Test slow request handling
    console.log('\n⏱️ Test 4: Testing slow request handling...');
    const slowStart = Date.now();
    try {
      // This should timeout after 5 seconds
      const slowResponse = await fetch(`${BASE_URL}/api/test/slow?delay=6000`, {
        signal: AbortSignal.timeout(7000)
      });
      console.log('⚠️ Slow request completed with status:', slowResponse.status);
    } catch (error) {
      const elapsed = Date.now() - slowStart;
      console.log(`✅ Request handling: ${error.name} after ${elapsed}ms`);
    }

    // Test 5: Check performance report
    console.log('\n📄 Test 5: Generating performance report...');
    const reportResponse = await fetch(`${BASE_URL}/api/performance/report`);
    if (reportResponse.ok) {
      const report = await reportResponse.text();
      console.log('✅ Performance report generated');
      console.log('\n--- REPORT PREVIEW ---');
      console.log(report.split('\n').slice(0, 15).join('\n'));
      console.log('... (truncated)');
    } else {
      console.log('❌ Failed to generate report:', reportResponse.status);
    }

    // Test 6: Check metrics after traffic
    console.log('\n📊 Test 6: Checking metrics after traffic...');
    await delay(1000); // Wait for metrics to be recorded
    
    const finalMetricsResponse = await fetch(`${BASE_URL}/api/performance/metrics`);
    const finalMetrics = await finalMetricsResponse.json();
    
    if (finalMetrics.success && finalMetrics.metrics) {
      console.log('✅ Final metrics summary:');
      const m = finalMetrics.metrics;
      console.log(`  - Mode: ${finalMetrics.mode}`);
      console.log(`  - Last 5 min requests: ${m.last5Minutes?.count || 0}`);
      console.log(`  - Avg response time: ${m.last5Minutes?.avgResponseTime?.toFixed(2) || 'N/A'}ms`);
      console.log(`  - Error rate: ${m.last5Minutes?.errorRate?.toFixed(2) || 0}%`);
      console.log(`  - Total metrics tracked: ${m.totalMetrics || 0}`);
    }

    console.log('\n✅ All performance middleware tests completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testPerformanceMiddleware().catch(console.error);
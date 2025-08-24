#!/usr/bin/env tsx

/**
 * Test script for rate limiting functionality
 */

import { log, LogContext } from '../src/utils/logger';

const API_URL = process.env.API_URL || 'http://localhost:8080';

interface RateLimitHeaders {
  limit?: string;
  remaining?: string;
  reset?: string;
  retryAfter?: string;
}

async function makeRequest(endpoint: string): Promise<{
  status: number;
  headers: RateLimitHeaders;
  body: unknown;
}> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const headers: RateLimitHeaders = {
    limit: response.headers.get('RateLimit-Limit') || undefined,
    remaining: response.headers.get('RateLimit-Remaining') || undefined,
    reset: response.headers.get('RateLimit-Reset') || undefined,
    retryAfter: response.headers.get('Retry-After') || undefined
  };

  const body = await response.json().catch(() => ({}));

  return { status: response.status, headers, body };
}

async function testEndpoint(endpoint: string, requestCount: number) {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(`\n🧪 Testing ${endpoint} with ${requestCount} requests...`);
  
  const results: Array<{ status: number; remaining?: string }> = [];
  let rateLimited = 0;

  for (let i = 0; i < requestCount; i++) {
    try {
      const result = await makeRequest(endpoint);
      results.push({
        status: result.status,
        remaining: result.headers.remaining
      });

      if (result.status === 429) {
        rateLimited++;
        console.log(`  ❌ Request ${i + 1}: Rate limited! Retry after: ${result.headers.retryAfter}s`);
      } else {
        console.log(`  ✅ Request ${i + 1}: Success (${result.headers.remaining} remaining)`);
      }

      // Small delay to make output readable
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.log(`  ❌ Request ${i + 1}: Error - ${error}`);
    }
  }

  console.log(`\n📊 Summary for ${endpoint}:`);
  console.log(`  Total requests: ${requestCount}`);
  console.log(`  Successful: ${requestCount - rateLimited}`);
  console.log(`  Rate limited: ${rateLimited}`);
}

async function testBurstRequests(endpoint: string, burstSize: number) {
  console.log(`\n🚀 Testing burst of ${burstSize} concurrent requests to ${endpoint}...`);
  
  const promises = Array.from({ length: burstSize }, () => makeRequest(endpoint));
  const results = await Promise.all(promises);
  
  const rateLimited = results.filter(r => r.status === 429).length;
  const successful = results.filter(r => r.status === 200).length;
  
  console.log(`\n📊 Burst test results:`);
  console.log(`  Total requests: ${burstSize}`);
  console.log(`  Successful: ${successful}`);
  console.log(`  Rate limited: ${rateLimited}`);
  
  // Show first rate limit info
  const firstResult = results[0];
  if (firstResult.headers.limit) {
    console.log(`  Rate limit: ${firstResult.headers.limit} requests per window`);
  }
}

async function testDifferentEndpoints() {
  console.log('\n🔄 Testing different endpoints with their specific limits...\n');
  
  const endpoints = [
    { path: '/health', expectedLimit: 100 },  // Default limit
    { path: '/api/v1/memory', expectedLimit: 50 },
    { path: '/api/v1/orchestration', expectedLimit: 30 },
    { path: '/api/v1/speech', expectedLimit: 20 },
    { path: '/api/v1/knowledge', expectedLimit: 40 }
  ];
  
  for (const endpoint of endpoints) {
    const result = await makeRequest(endpoint.path);
    console.log(`${endpoint.path}:`);
    console.log(`  Expected limit: ${endpoint.expectedLimit}`);
    console.log(`  Actual limit: ${result.headers.limit}`);
    console.log(`  Remaining: ${result.headers.remaining}`);
    console.log(`  Reset: ${result.headers.reset}`);
    console.log(`  Status: ${result.status}`);
    console.log('');
  }
}

async function main() {
  console.log('🔧 Rate Limiting Test Suite');
  console.log(`📍 Testing against: ${API_URL}`);
  console.log('================================\n');

  try {
    // Test 1: Check if server is running
    console.log('🏃 Checking server health...');
    const health = await makeRequest('/health');
    if (health.status !== 200) {
      throw new Error('Server is not responding properly');
    }
    console.log('✅ Server is healthy\n');

    // Test 2: Test different endpoints
    await testDifferentEndpoints();

    // Test 3: Test sequential requests
    await testEndpoint('/api/v1/memory', 10);

    // Test 4: Test burst requests
    await testBurstRequests('/api/v1/orchestration', 50);

    // Test 5: Test auth endpoint (stricter limits)
    console.log('\n🔐 Testing auth endpoint with strict limits...');
    console.log('Note: /api/v1/auth/login has a limit of 5 requests per 15 minutes');
    await testEndpoint('/api/v1/auth/login', 7);

    console.log('\n✅ All tests completed!');
  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
main().catch(console.error);